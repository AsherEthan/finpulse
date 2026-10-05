import { selectedCondition, pendingReleaseCondition, listedCondition } from "./scope.ts";
import type { FeedItemSummary } from "@aihot/contracts/site";
import type { CategoryKey } from "@aihot/contracts/taxonomy";
import { DISCLOSURE_TOPICS, ECONOMICS_TOPICS } from "@aihot/industry/taxonomy";
import { readFileSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "../config.ts";
import { sql } from "../db.ts";
import { cached } from "../lib/cache.ts";
import { ITEM_COLUMNS, ITEM_FROM, toFeedItemSummary, categoryCondition, type ItemRow } from "./items.ts";

export interface TopicRow {
  slug: string;
  name: string;
  grp: "company" | "field" | "genre";
  entity_id: string | null;
  tags: string[];
  definition: string;
  related: string[];
  position: number;
}

export interface TopicOptions { view?: "all" | "selected"; category?: CategoryKey | null }
const paperTopics = new Set<string>(["papers", ...ECONOMICS_TOPICS.map(t => t.slug)]);
const disclosureTopics = new Set<string>(DISCLOSURE_TOPICS.map(t => t.slug));
function topicScope(slug: string, options: TopicOptions) {
  const defaultCategory = slug.startsWith("policy-") ? "policy" : paperTopics.has(slug) ? "papers" : disclosureTopics.has(slug) ? "first-hand" : null;
  return { view: options.view ?? (defaultCategory ? "all" : "selected"), category: options.category ?? defaultCategory } as const;
}
type TopicCount = { slug: string; total: number; recent: number; pages: number; indexable: boolean; latest: Date | null; allCount: number; selectedCount: number };
const topicsCache = cached(
  () => sql<TopicRow[]>`SELECT slug, name, grp, entity_id, tags, definition, related, position FROM topics ORDER BY position`,
  { freshMs: 60_000, maxStaleMs: 10 * 60_000 },
);
export interface TopicCountSnapshot { counts: TopicCount[]; refreshAt: string | null }
// 已知的发布或近期窗口截止必须同步刷新，不能继续返回后台更新中的旧统计。
const countsCache = cached(() => queryTopicCounts(new Date()), {
  freshMs: 60_000, maxStaleMs: 10 * 60_000,
  expiresAt: (value) => value.refreshAt ? Date.parse(value.refreshAt) : null,
});

/**
 * The topics (stable slugs, names, definitions, related topics) come from the industry pack
 * (industry/topics.json); every environment seeds them from there. Re-runnable.
 */
export async function seedTopics(): Promise<number> {
  const data = JSON.parse(readFileSync(path.join(REPO_ROOT, "industry/topics.json"), "utf8")) as {
    topics: Array<{ slug: string; name: string; group: string; entityId?: string | null; tags: string[]; definition: string; related?: string[] }>;
  };
  let position = 0;
  for (const t of data.topics) {
    await sql`
      INSERT INTO topics (slug, name, grp, entity_id, tags, definition, related, position)
      VALUES (${t.slug}, ${t.name}, ${t.group}, ${t.entityId ?? null}, ${t.tags}, ${t.definition}, ${t.related ?? []}, ${position++})
      ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, grp = EXCLUDED.grp, entity_id = EXCLUDED.entity_id,
        tags = EXCLUDED.tags, definition = EXCLUDED.definition, related = EXCLUDED.related, position = EXCLUDED.position`;
  }
  topicsCache.clear();
  countsCache.clear();
  return data.topics.length;
}

export function listTopics(): Promise<TopicRow[]> {
  return topicsCache.get();
}

export async function loadTopic(slug: string): Promise<TopicRow | null> {
  return (await listTopics()).find((t) => t.slug === slug) ?? null;
}

/**
 * Tags that put an article in a topic. A company topic takes only articles actually about the company
 * (its entity subject tag), never mere mentions; field and genre topics match their tags.
 */
export function topicMatchTags(t: Pick<TopicRow, "entity_id" | "tags">): string[] {
  return t.entity_id ? [`entity:${t.entity_id}`] : t.tags;
}

export async function loadTopicTags(slug: string): Promise<string[] | null> {
  const t = await loadTopic(slug);
  return t ? topicMatchTags(t) : null;
}

export const TOPIC_PAGE_SIZE = 20;

/** Topic pages exist for every topic; only topics with enough content are listed and indexed. */
export async function topicPageCounts(now?: Date): Promise<TopicCount[]> {
  return (await topicCountSnapshot(now, { view: "selected" })).counts;
}

export function topicCountSnapshot(now?: Date, options: TopicOptions = {}): Promise<TopicCountSnapshot> {
  // 显式时间用于同一请求的计数与条目读取，不混入其他时刻的共享缓存。
  return now || options.view || options.category ? queryTopicCounts(now ?? new Date(), options) : countsCache.get();
}

/**
 * One pass over the selected set (a few thousand rows from its partial index) instead of one
 * scan per topic; a topic counts an item when their tags overlap, as `p.tags && match` does.
 */
async function queryTopicCounts(now: Date, options: TopicOptions = {}): Promise<TopicCountSnapshot> {
  const [topics, items, pending] = await Promise.all([
    sql<Array<Pick<TopicRow, "slug" | "entity_id" | "tags">>>`SELECT slug, entity_id, tags FROM topics ORDER BY position`,
    sql<{ tags: string[]; timeline_at: Date; category: string | null; in_pool: boolean; in_selected: boolean }[]>`
      SELECT p.tags, p.timeline_at, p.category, (${listedCondition(now)}) AS in_pool, (${selectedCondition(now)}) AS in_selected
      FROM publications p WHERE (${listedCondition(now)} OR ${selectedCondition(now)}) ${categoryCondition(options.category)}`,
    sql<{ t: Date | null }[]>`SELECT min(p.visible_after) AS t FROM publications p
      WHERE ${pendingReleaseCondition(now)} ${categoryCondition(options.category)}`,
  ]);
  const recentFrom = now.getTime() - 30 * 86400_000;
  let deadline = pending[0]?.t?.getTime() ?? Infinity;
  for (const item of items) {
    const expires = item.timeline_at.getTime() + 30 * 86400_000;
    if (expires > now.getTime()) deadline = Math.min(deadline, expires);
  }
  const counts = topics.map((t) => {
    const { view, category } = topicScope(t.slug, options);
    const match = new Set(topicMatchTags(t));
    let allCount = 0, selectedCount = 0, allRecent = 0, selectedRecent = 0;
    let allLatest: Date | null = null, selectedLatest: Date | null = null;
    for (const it of items) {
      if (category && it.category !== category) continue;
      if (!it.tags.some((tag) => match.has(tag))) continue;
      if (it.in_pool) {
        allCount += 1;
        if (it.timeline_at.getTime() > recentFrom) allRecent += 1;
        if (!allLatest || it.timeline_at > allLatest) allLatest = it.timeline_at;
      }
      if (it.in_selected) {
        selectedCount += 1;
        if (it.timeline_at.getTime() > recentFrom) selectedRecent += 1;
        if (!selectedLatest || it.timeline_at > selectedLatest) selectedLatest = it.timeline_at;
      }
    }
    const total = view === "all" ? allCount : selectedCount;
    const recent = view === "all" ? allRecent : selectedRecent;
    const latest = view === "all" ? allLatest : selectedLatest;
    // Existing indexing thresholds continue to depend on the curated set.
    return { slug: t.slug, total, recent, latest, allCount, selectedCount,
      pages: Math.max(1, Math.ceil(total / TOPIC_PAGE_SIZE)), indexable: selectedCount >= 50 || (selectedCount >= 20 && selectedRecent > 0) };
  });
  return { counts, refreshAt: Number.isFinite(deadline) ? new Date(deadline).toISOString() : null };
}

/** Counts read the current tags; cached catalog metadata retains the existing page semantics. */
async function queryTopicCount(slug: string, now: Date, options: TopicOptions): Promise<{ count: TopicCount; refreshAt: string | null }> {
  const { view, category } = topicScope(slug, options);
  const [topic] = await sql<Array<Pick<TopicRow, "entity_id" | "tags">>>`SELECT entity_id, tags FROM topics WHERE slug = ${slug}`;
  const recentMs = 30 * 86400_000;
  const recentStart = new Date(now.getTime() - recentMs + 1);
  const [row] = await sql<Array<{
    all_count: number; selected_count: number; all_recent: number; selected_recent: number;
    all_latest: Date | null; selected_latest: Date | null; pending: Date | null; oldest_recent: Date | null;
  }>>`
    SELECT count(*) FILTER (WHERE ${listedCondition(now)})::int AS all_count,
      count(*) FILTER (WHERE ${selectedCondition(now)})::int AS selected_count,
      count(*) FILTER (WHERE ${listedCondition(now)} AND p.timeline_at >= ${recentStart})::int AS all_recent,
      count(*) FILTER (WHERE ${selectedCondition(now)} AND p.timeline_at >= ${recentStart})::int AS selected_recent,
      max(p.timeline_at) FILTER (WHERE ${listedCondition(now)}) AS all_latest,
      max(p.timeline_at) FILTER (WHERE ${selectedCondition(now)}) AS selected_latest,
      (SELECT min(p.visible_after) FROM publications p WHERE ${pendingReleaseCondition(now)} ${categoryCondition(category)}) AS pending,
      (SELECT min(p.timeline_at) FROM publications p WHERE (${listedCondition(now)} OR ${selectedCondition(now)})
        ${categoryCondition(category)} AND p.timeline_at >= ${recentStart}) AS oldest_recent
    FROM publications p WHERE (${listedCondition(now)} OR ${selectedCondition(now)})
      ${categoryCondition(category)} AND p.tags && ${topic ? topicMatchTags(topic) : []}::text[]`;
  const total = view === "all" ? row!.all_count : row!.selected_count;
  const recent = view === "all" ? row!.all_recent : row!.selected_recent;
  const latest = view === "all" ? row!.all_latest : row!.selected_latest;
  const deadline = Math.min(row!.pending?.getTime() ?? Infinity, row!.oldest_recent ? row!.oldest_recent.getTime() + recentMs : Infinity);
  return { count: { slug, total, recent, latest, allCount: row!.all_count, selectedCount: row!.selected_count,
    pages: Math.max(1, Math.ceil(total / TOPIC_PAGE_SIZE)), indexable: row!.selected_count >= 50 || (row!.selected_count >= 20 && row!.selected_recent > 0) },
    refreshAt: Number.isFinite(deadline) ? new Date(deadline).toISOString() : null };
}

export interface TopicSummary {
  slug: string;
  name: string;
  group: "company" | "field" | "genre";
  definition: string;
  total: number;
  allCount: number;
  selectedCount: number;
  recent: number;
  indexable: boolean;
  latestAt: string | null;
}

export async function listTopicSummaries(now?: Date): Promise<TopicSummary[]> {
  return (await loadTopicDirectory(now)).topics;
}

export async function loadTopicDirectory(now?: Date, options: TopicOptions = {}): Promise<{ topics: TopicSummary[]; refreshAt: string | null }> {
  const [topics, snapshot] = await Promise.all([listTopics(), topicCountSnapshot(now, options)]);
  const counts = new Map(snapshot.counts.map((c) => [c.slug, c]));
  const summaries = topics.map((t) => {
    const c = counts.get(t.slug);
    return { slug: t.slug, name: t.name, group: t.grp, definition: t.definition, total: c?.total ?? 0, allCount: c?.allCount ?? 0, selectedCount: c?.selectedCount ?? 0, recent: c?.recent ?? 0, indexable: c?.indexable ?? false, latestAt: c?.latest?.toISOString() ?? null };
  });
  return { topics: summaries, refreshAt: snapshot.refreshAt };
}

export interface TopicPage {
  topic: TopicSummary & { related: Array<{ slug: string; name: string }> };
  items: FeedItemSummary[];
  page: number;
  pageCount: number;
  refreshAt: string | null;
  view: "all" | "selected";
  category: CategoryKey | null;
}

export async function loadTopicPage(slug: string, page: number, now = new Date(), options: TopicOptions = {}): Promise<TopicPage | null> {
  const topics = await listTopics();
  const row = topics.find((t) => t.slug === slug);
  if (!row || !Number.isInteger(page) || page < 1) return null;
  const { view, category } = topicScope(slug, options);
  const { count, refreshAt } = await queryTopicCount(slug, now, { ...options, view, category });
  const topic: TopicSummary = { slug: row.slug, name: row.name, group: row.grp, definition: row.definition,
    total: count.total, allCount: count.allCount, selectedCount: count.selectedCount, recent: count.recent, indexable: count.indexable, latestAt: count.latest?.toISOString() ?? null };
  const pageCount = count.pages;
  if (page < 1 || page > pageCount) return null;
  // Page ids from the selected set first, then the joins for those rows only.
  const rows = await sql<ItemRow[]>`
    WITH page AS (
      SELECT p.article_id FROM publications p
      WHERE ${view === "all" ? listedCondition(now) : selectedCondition(now)} ${categoryCondition(category)} AND p.tags && ${topicMatchTags(row)}::text[]
      ORDER BY p.timeline_at DESC, p.article_id DESC
      LIMIT ${TOPIC_PAGE_SIZE} OFFSET ${(page - 1) * TOPIC_PAGE_SIZE})
    SELECT ${ITEM_COLUMNS} ${ITEM_FROM} WHERE p.article_id IN (SELECT article_id FROM page)
    ORDER BY p.timeline_at DESC, p.article_id DESC`;
  const related = row.related.map((r) => topics.find((t) => t.slug === r)).filter((t): t is TopicRow => !!t).map((t) => ({ slug: t.slug, name: t.name }));
  return { topic: { ...topic, related }, items: rows.map(toFeedItemSummary), page, pageCount, refreshAt, view, category };
}
