import { tag } from "./setup.ts";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { closeDb, sql } from "@aihot/backend/db";
import { ECONOMICS_TOPICS } from "@aihot/industry/taxonomy";
import { loadTopicDirectory, loadTopicPage } from "@aihot/backend/publication/topics";

const T = tag();
const SOURCE = `economics-topics-${T}`;
const MATCH = `economics-match-${T}`;
const PAPER_TOPICS = ["papers", ...ECONOMICS_TOPICS.map(topic => topic.slug)];
const POLICY_TOPIC = `policy-economics-test-${T}`;
const ORDINARY_TOPIC = `economics-ordinary-${T}`;
const NOW = new Date("2026-10-04T12:00:00Z");
const DAY = 86_400_000;
const saved = await sql<{ slug: string; tags: string[] }[]>`SELECT slug, tags FROM topics WHERE slug = ANY(${PAPER_TOPICS}::text[])`;
const created = PAPER_TOPICS.filter(slug => !saved.some(topic => topic.slug === slug));
after(async () => {
  await sql`DELETE FROM articles WHERE source_id=${SOURCE}`;
  await sql`DELETE FROM sources WHERE id=${SOURCE}`;
  await sql`DELETE FROM topics WHERE slug = ANY(${[...created, POLICY_TOPIC, ORDINARY_TOPIC]}::text[])`;
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
    VALUES(${id},${name},'Scope test',${SOURCE},'news',${url},${at},${at},${at},${category},${selected},
      ${options.eligible ?? true},${options.visibility ?? "public"},${release},${[MATCH]})`;
  return id;
}

test("economics topics default to the paper pool without counting matching macro data", async t => {
  await sql`INSERT INTO sources(id,name,kind,tier,participation_mode,next_fetch_at)
    VALUES(${SOURCE},'Economics topic test','rss','T1_5','editorial','2100-01-01')`;
  for (const slug of [...PAPER_TOPICS, POLICY_TOPIC, ORDINARY_TOPIC]) {
    await sql`INSERT INTO topics(slug,name,grp,tags,definition,position)
      VALUES(${slug},${slug},'field',${[MATCH]},'Scope test',9999)
      ON CONFLICT(slug) DO UPDATE SET tags=EXCLUDED.tags`;
  }
  const selectedPaper = await article("selected-paper", "papers", true);
  const pooledPaper = await article("pooled-paper", "papers", false);
  const pendingPaper = await article("pending-paper", "papers", true, { pending: true });
  await article("withdrawn-paper", "papers", false, { visibility: "withdrawn" });
  await article("ineligible-paper", "papers", false, { eligible: false });
  await article("summary-only-paper", "papers", false, { visibility: "summary-only" });
  // Enough selected data to make a wrongly unscoped economics topic indexable.
  for (let i = 0; i < 20; i++) await article(`macro-data-${i}`, "first-hand", true);
  await article("pooled-macro-data", "first-hand", false);
  const policy = await article("policy", "policy", false);

  await t.test("paper genre and every economics field share directory and detail scope", async () => {
    const directory = await loadTopicDirectory(NOW);
    for (const slug of PAPER_TOPICS) {
      const summary = directory.topics.find(topic => topic.slug === slug)!;
      const page = (await loadTopicPage(slug, 1, NOW))!;
      assert.ok(summary);
      assert.ok(page);
      assert.deepEqual([page.view, page.category], ["all", "papers"]);
      assert.deepEqual([summary.total, summary.allCount, summary.selectedCount, summary.indexable], [2, 2, 1, false]);
      const { related, ...detailSummary } = page.topic;
      assert.deepEqual(detailSummary, summary);
      assert.deepEqual(page.items.map(item => item.id).sort(), [selectedPaper, pooledPaper].sort());
    }
  });

  await t.test("explicit selected view retains the paper boundary", async () => {
    const directory = await loadTopicDirectory(NOW, { view: "selected" });
    for (const slug of PAPER_TOPICS) {
      const summary = directory.topics.find(topic => topic.slug === slug)!;
      const page = (await loadTopicPage(slug, 1, NOW, { view: "selected" }))!;
      assert.deepEqual([page.view, page.category, page.topic.total], ["selected", "papers", 1]);
      assert.deepEqual([summary.total, summary.allCount, summary.selectedCount], [1, 2, 1]);
      assert.deepEqual(page.items.map(item => item.id), [selectedPaper]);
    }
  });

  await t.test("policy defaults and ordinary selected topics keep their existing behavior", async () => {
    const directory = await loadTopicDirectory(NOW);
    const policyPage = (await loadTopicPage(POLICY_TOPIC, 1, NOW))!;
    assert.deepEqual([policyPage.view, policyPage.category, policyPage.topic.total], ["all", "policy", 1]);
    assert.deepEqual(policyPage.items.map(item => item.id), [policy]);
    assert.equal(directory.topics.find(topic => topic.slug === POLICY_TOPIC)!.total, 1);
    const ordinary = (await loadTopicPage(ORDINARY_TOPIC, 1, NOW))!;
    assert.deepEqual([ordinary.view, ordinary.category, ordinary.topic.total], ["selected", null, 21]);
    assert.equal(directory.topics.find(topic => topic.slug === ORDINARY_TOPIC)!.total, 21);
    const policySelected = (await loadTopicPage(POLICY_TOPIC, 1, NOW, { view: "selected" }))!;
    assert.deepEqual([policySelected.category, policySelected.topic.total], ["policy", 0]);
  });

  await t.test("paper release gates apply equally to directory counts and page items", async () => {
    const released = new Date(NOW.getTime() + DAY);
    const directory = await loadTopicDirectory(released);
    const page = (await loadTopicPage("papers", 1, released))!;
    assert.deepEqual([page.topic.total, page.topic.allCount, page.topic.selectedCount], [3, 3, 2]);
    assert.equal(directory.topics.find(topic => topic.slug === "papers")!.total, 3);
    assert.deepEqual(page.items.map(item => item.id).sort(), [selectedPaper, pooledPaper, pendingPaper].sort());
  });
});
