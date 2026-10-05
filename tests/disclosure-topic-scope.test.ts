import { tag } from "./setup.ts";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { closeDb, sql } from "@aihot/backend/db";
import { DISCLOSURE_TOPICS } from "@aihot/industry/taxonomy";
import { loadTopicDirectory, loadTopicPage } from "@aihot/backend/publication/topics";

const T = tag();
const SOURCE = `disclosure-topics-${T}`;
const MATCH = `disclosure-match-${T}`;
const SLUGS = DISCLOSURE_TOPICS.map(topic => topic.slug);
const NOW = new Date("2026-10-04T12:00:00Z");
const DAY = 86_400_000;
const saved = await sql<{ slug: string; tags: string[] }[]>`SELECT slug, tags FROM topics WHERE slug = ANY(${SLUGS}::text[])`;
const created = SLUGS.filter(slug => !saved.some(topic => topic.slug === slug));
after(async () => {
  await sql`DELETE FROM articles WHERE source_id=${SOURCE}`;
  await sql`DELETE FROM sources WHERE id=${SOURCE}`;
  await sql`DELETE FROM topics WHERE slug = ANY(${created}::text[])`;
  for (const topic of saved) await sql`UPDATE topics SET tags=${topic.tags} WHERE slug=${topic.slug}`;
  await closeDb();
});

async function article(name: string, category: string, selected: boolean, options: { eligible?: boolean; visibility?: string; pending?: boolean } = {}) {
  const id = `${T}-${name}`;
  const url = `https://example.test/${id}`;
  const at = new Date(NOW.getTime() - DAY);
  const release = new Date(NOW.getTime() + (options.pending ? DAY : -DAY));
  await sql`INSERT INTO articles(id,source_id,identity_key,url,title,discovered_at,timeline_at)
    VALUES(${id},${SOURCE},${id},${url},${name},${at},${at})`;
  await sql`INSERT INTO publications(article_id,title,summary,source_id,channel,url,discovered_at,timeline_at,sort_at,
    category,selected,eligible,visibility,visible_after,tags)
    VALUES(${id},${name},'Disclosure scope test',${SOURCE},'news',${url},${at},${at},${at},${category},${selected},
      ${options.eligible ?? true},${options.visibility ?? "public"},${release},${[MATCH]})`;
  return id;
}

test("disclosure topics count and list only published disclosure data by default", async t => {
  await sql`INSERT INTO sources(id,name,kind,tier,participation_mode,next_fetch_at)
    VALUES(${SOURCE},'Disclosure topic test','rss','T1','editorial','2100-01-01')`;
  for (const slug of SLUGS) {
    await sql`INSERT INTO topics(slug,name,grp,tags,definition,position)
      VALUES(${slug},${slug},'field',${[MATCH]},'Disclosure scope test',9999)
      ON CONFLICT(slug) DO UPDATE SET tags=EXCLUDED.tags`;
  }
  const selectedData = await article("selected-data", "first-hand", true);
  const pooledData = await article("pooled-data", "first-hand", false);
  const pendingData = await article("pending-data", "first-hand", true, { pending: true });
  await article("withdrawn-data", "first-hand", false, { visibility: "withdrawn" });
  await article("ineligible-data", "first-hand", false, { eligible: false });
  await article("summary-only-data", "first-hand", false, { visibility: "summary-only" });
  // Same tags in other columns must neither inflate disclosure counts nor make them indexable.
  for (let i = 0; i < 20; i++) await article(`paper-${i}`, "papers", true);
  await article("industry-data", "supply-chain", true);

  await t.test("all six subjects share the same directory and detail scope", async () => {
    const directory = await loadTopicDirectory(NOW);
    for (const slug of SLUGS) {
      const summary = directory.topics.find(topic => topic.slug === slug)!;
      const page = (await loadTopicPage(slug, 1, NOW))!;
      assert.ok(summary);
      assert.ok(page);
      assert.deepEqual([page.view, page.category], ["all", "first-hand"]);
      assert.deepEqual([summary.total, summary.allCount, summary.selectedCount, summary.indexable], [2, 2, 1, false]);
      const { related, ...detailSummary } = page.topic;
      assert.deepEqual(detailSummary, summary);
      assert.deepEqual(page.items.map(item => item.id).sort(), [selectedData, pooledData].sort());
    }
  });

  await t.test("explicit selected view retains the disclosure category boundary", async () => {
    const directory = await loadTopicDirectory(NOW, { view: "selected" });
    for (const slug of SLUGS) {
      const summary = directory.topics.find(topic => topic.slug === slug)!;
      const page = (await loadTopicPage(slug, 1, NOW, { view: "selected" }))!;
      assert.deepEqual([page.view, page.category, page.topic.total], ["selected", "first-hand", 1]);
      assert.deepEqual([summary.total, summary.allCount, summary.selectedCount, summary.indexable], [1, 2, 1, false]);
      assert.deepEqual(page.items.map(item => item.id), [selectedData]);
    }
  });

  await t.test("release delay changes directory counts and page items at the same instant", async () => {
    const released = new Date(NOW.getTime() + DAY);
    for (const at of [new Date(released.getTime() - 1), released]) {
      const directory = await loadTopicDirectory(at);
      const expected = at < released ? [selectedData, pooledData] : [selectedData, pooledData, pendingData];
      for (const slug of SLUGS) {
        const page = (await loadTopicPage(slug, 1, at))!;
        assert.equal(page.topic.total, expected.length);
        assert.equal(directory.topics.find(topic => topic.slug === slug)!.total, expected.length);
        assert.deepEqual(page.items.map(item => item.id).sort(), expected.sort());
      }
    }
  });
});
