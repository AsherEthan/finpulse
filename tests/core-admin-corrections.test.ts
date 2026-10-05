import { tag } from "./setup.ts";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { sql, closeDb } from "@aihot/backend/db";
import { createSource, listSources, updateSource } from "@aihot/backend/admin/sources";
import { overrideFields, rerun, searchContent, setSeoIndexed, setVisibility } from "@aihot/backend/admin/content";
import { upsertMaterial } from "@aihot/backend/content/materials";
import { publishArticle } from "@aihot/backend/publication/publish";
import { loadPool } from "@aihot/backend/publication/pool";
import { loadTimeline } from "@aihot/backend/publication/timeline";
import { config } from "@aihot/backend/config";
import { getBoss, stopBoss } from "@aihot/backend/jobs/queue";

const T = tag();
const sourceId = `admin-${T}`;
await sql`INSERT INTO sources (id, name, kind, tier) VALUES (${sourceId}, 'Admin review', 'rss', 'T1')`;
after(async () => { await stopBoss(); await closeDb(); });

async function article(url = `https://example.com/${tag()}`, title = "审查材料") {
  return (await upsertMaterial({ sourceId, url, title, bodyText: "正文", bodyStatus: "ok", via: "fetch", publishedAt: new Date() })).articleId;
}

test("diagnostics find URL aliases, unpublished titles and an exact ID even when other titles mention it", async () => {
  const tweetId = `${Date.now()}123456`;
  const rawTitle = `只有原文的标题 ${T}`;
  const tweet = await article(`https://x.com/example/status/${tweetId}`, "原始标题");
  const web = await article(`https://example.com/${T}?utm_source=feed`, rawTitle);
  await article(undefined, `引用 ${tweet} 的另一篇文章`);
  assert.deepEqual((await searchContent(tweet)).map((r) => r.id), [tweet]);
  assert.deepEqual((await searchContent(`https://twitter.com/another/status/${tweetId}?s=20`)).map((r) => r.id), [tweet]);
  assert.deepEqual((await searchContent(`https://example.com/${T}?utm_source=other`)).map((r) => r.id), [web]);
  assert.deepEqual((await searchContent(rawTitle)).map((r) => r.id), [web]);
  assert.deepEqual(await searchContent("  "), []);
});

test("concurrent source intake creates one source for the same feed", async () => {
  const blocker = await sql.reserve();
  await blocker`BEGIN`;
  await blocker`LOCK TABLE sources IN SHARE MODE`;
  const pending = Promise.all(Array.from({ length: 4 }, (_, i) => createSource({
    id: `intake-${T}-${i}`, name: "Same feed", kind: "rss", config: { feedUrl: `https://example.com/feed-${T}` },
  }, "test")));
  try {
    // Hold inserts until all four requests have reached a lock: reproduce simultaneous clicks,
    // independently of how quickly the database happens to execute their duplicate checks.
    for (let i = 0; ; i++) {
      const [waiting] = await sql`SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'`;
      if (waiting!.n === 4) break;
      assert.ok(i < 200, "all concurrent requests reached the database");
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  } finally {
    await blocker`ROLLBACK`;
    blocker.release();
  }
  const results = await pending;
  assert.equal(results.filter((r) => r.created).length, 1);
  const created = results.find((r) => r.created)!;
  assert.ok(created.created);
  for (const result of results) if (!result.created) assert.equal(result.duplicate.id, created.source.id);
});

test("source counts preserve selected, unselected and out-of-window distinctions", async () => {
  const recent = await article();
  const old = await article();
  const unselected = await article();
  for (const id of [recent, old, unselected]) await publishArticle(id);
  await sql`UPDATE publications SET selected = true, discovered_at = now() - interval '1 day' WHERE article_id = ${recent}`;
  await sql`UPDATE publications SET selected = true, discovered_at = now() - interval '31 days' WHERE article_id = ${old}`;
  const list = await listSources({ q: sourceId });
  assert.equal(list.rows.length, 1);
  assert.equal(list.rows[0]!.selected_30d, 1);
  assert.ok(list.rows[0]!.items_7d >= 3);
});

test("a source transaction rolled back at commit leaves no successful audit entry", async () => {
  await sql.unsafe(`CREATE FUNCTION refuse_admin_source_commit() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.name = 'refuse-admin-commit' THEN RAISE EXCEPTION 'refused at commit'; END IF; RETURN NEW; END $$`);
  await sql.unsafe(`CREATE CONSTRAINT TRIGGER refuse_admin_source_commit AFTER UPDATE ON sources
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION refuse_admin_source_commit()`);
  try {
    const [before] = await sql`SELECT updated_at FROM sources WHERE id = ${sourceId}`;
    await assert.rejects(updateSource(sourceId, { patch: { name: "refuse-admin-commit" }, version: (before!.updated_at as Date).toISOString() }, "test-rollback"), /refused at commit/);
    const rows = await sql`SELECT 1 FROM audit_log WHERE actor = 'test-rollback'`;
    assert.equal(rows.length, 0);
  } finally {
    await sql.unsafe("DROP TRIGGER refuse_admin_source_commit ON sources; DROP FUNCTION refuse_admin_source_commit()");
  }
});

test("content corrections, public projection and audit either commit together or remain retryable", async () => {
  const id = await article();
  await publishArticle(id);
  await sql.unsafe(`CREATE FUNCTION refuse_admin_audit() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.actor = 'test-refuse-audit' THEN RAISE EXCEPTION 'audit unavailable'; END IF; RETURN NEW; END $$`);
  await sql.unsafe("CREATE TRIGGER refuse_admin_audit BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION refuse_admin_audit()");
  try {
    for (const write of [
      () => overrideFields(id, { fields: { title: "更正标题" }, version: 0, reason: "校正" }, "test-refuse-audit"),
      () => setVisibility(id, { visibility: "withdrawn", version: 0, reason: "校正" }, "test-refuse-audit"),
    ]) {
      await assert.rejects(write(), /audit unavailable/);
      assert.equal((await sql`SELECT 1 FROM editorial_overrides WHERE article_id = ${id}`).length, 0);
      const [p] = await sql`SELECT title, visibility FROM publications WHERE article_id = ${id}`;
      assert.equal(p!.title, "审查材料");
      assert.equal(p!.visibility, "public");
    }
  } finally {
    await sql.unsafe("DROP TRIGGER refuse_admin_audit ON audit_log; DROP FUNCTION refuse_admin_audit()");
  }
  await overrideFields(id, { fields: { title: "更正标题" }, version: 0, reason: "校正" }, "test");
  await assert.rejects(setVisibility(id, { visibility: "withdrawn", version: 0, reason: "过期页面" }, "test"), { code: "conflict" });
  const [p] = await sql`SELECT title, visibility FROM publications WHERE article_id = ${id}`;
  assert.equal(p!.title, "更正标题");
  assert.equal(p!.visibility, "public");
});

test("manual review publishes collected policy without model analyses or invented scores and can revoke it", async () => {
  const publishedAt = new Date(Date.now() - 24 * 3600 * 1000);
  const reviewTag = `manual-policy-${T}`;
  const id = (await upsertMaterial({
    sourceId, url: `https://example.com/policy-${T}`, title: "关于公开征求金融监管规则意见的通知",
    excerpt: "现就金融监管规则公开征求意见，意见提交截止日期见原文。", publishedAt,
    bodyStatus: "pending", via: "fetch", backfill: "first-import",
  })).articleId;
  const [original] = await sql`SELECT published_at, timeline_at FROM articles WHERE id = ${id}`;
  const filters = { channel: "all" as const, category: "policy" as const, tag: reviewTag };
  const readPublication = async () => (await sql`SELECT eligible, selected, score, visible_after, selected_ready_at FROM publications WHERE article_id = ${id}`)[0]!;
  const poolAt = (now: Date) => loadPool({ ...filters, now });
  const timelineAt = (now: Date) => loadTimeline({ ...filters, now });

  await assert.rejects(overrideFields(id, { fields: { relevance: "approved" }, version: 0, reason: "无效审核状态" }, "test-review"));
  assert.equal((await sql`SELECT 1 FROM editorial_overrides WHERE article_id = ${id}`).length, 0);

  await overrideFields(id, {
    fields: {
      title: "金融监管规则公开征求意见", summary: "监管规则草案公开征求意见，反馈期限与提交方式以原文通知为准。",
      category: "policy", tags: ["政策/监管", "征求意见", reviewTag], relevance: "pass",
    }, version: 0, reason: "阅读官方通知，确认属于政策草案，保留原文链接",
  }, "test-review");
  let publication = await readPublication();
  assert.equal(publication.eligible, true);
  assert.equal(publication.selected, false);
  assert.equal(publication.score, null);
  assert.deepEqual((await poolAt(new Date())).items.map((item) => item.id), [id]);
  assert.equal((await timelineAt(new Date())).cards.length, 0);

  await overrideFields(id, {
    fields: { selected: true, reason: "规则草案涉及金融机构合规义务，值得跟踪意见反馈和最终文件。" },
    version: 1, reason: "人工明确选择，未进行模型评分",
  }, "test-review");
  publication = await readPublication();
  assert.equal(publication.selected, true);
  assert.equal(publication.score, null);
  assert.equal(publication.visible_after.getTime() - publication.selected_ready_at.getTime(), config.selectedVisibleAfterSeconds * 1000);
  const beforeRelease = new Date(publication.selected_ready_at.getTime() + 1);
  const afterRelease = new Date(publication.visible_after.getTime() + 1);
  assert.equal((await poolAt(beforeRelease)).items.length, 0);
  assert.equal((await timelineAt(beforeRelease)).cards.length, 0);
  assert.deepEqual((await timelineAt(afterRelease)).cards.map((card) => card.item.id), [id]);
  assert.equal((await timelineAt(afterRelease)).cards[0]!.item.score, null);
  assert.deepEqual((await sql`SELECT published_at, timeline_at FROM articles WHERE id = ${id}`)[0], original);
  assert.equal((await sql`SELECT 1 FROM analyses WHERE article_id = ${id}`).length, 0);

  await overrideFields(id, { fields: {}, clear: ["relevance"], version: 2, reason: "撤销人工相关性审核" }, "test-review");
  publication = await readPublication();
  assert.equal(publication.eligible, false);
  assert.equal(publication.selected, false);
  assert.equal((await poolAt(afterRelease)).items.length, 0);
  assert.equal((await timelineAt(afterRelease)).cards.length, 0);
  await assert.rejects(overrideFields(id, { fields: { relevance: "pass" }, version: 2, reason: "过期页面" }, "test-review"), { code: "conflict" });

  await overrideFields(id, { fields: { relevance: "pass" }, version: 3, reason: "重新核验原文" }, "test-review");
  assert.deepEqual((await poolAt(afterRelease)).items.map((item) => item.id), [id]);
  await overrideFields(id, { fields: { relevance: "block" }, version: 4, reason: "撤销公开资格" }, "test-review");
  publication = await readPublication();
  assert.equal(publication.eligible, false);
  assert.equal(publication.selected, false);
  assert.equal(publication.score, null);
  assert.equal((await poolAt(afterRelease)).items.length, 0);
  assert.equal((await timelineAt(afterRelease)).cards.length, 0);
  const [override] = await sql`SELECT version, fields FROM editorial_overrides WHERE article_id = ${id}`;
  assert.equal(override!.version, 5);
  assert.equal(override!.fields.relevance, "block");
  const history = await sql`SELECT before, after FROM audit_log WHERE subject = ${`content:${id}`} AND action = 'content.override' ORDER BY id`;
  assert.equal(history.length, 5);
  assert.equal(history[0]!.after.relevance, "pass");
  assert.equal(history[2]!.before.relevance, "pass");
  assert.equal(history[2]!.after.relevance, undefined);
  assert.equal(history[4]!.after.relevance, "block");
});

test("repeating a completed command returns its job without resetting newer processing or a manual detach", async () => {
  await getBoss();
  for (const step of ["analyze", "extract", "group"] as const) {
    const id = await article();
    const key = `request-${step}-${T}`;
    const first = await rerun(id, step, key, "test");
    assert.ok(first?.jobId);
    await sql`UPDATE pgboss.job SET state = 'completed', completed_on = now() WHERE id = ${first.jobId}`;
    await sql`UPDATE articles SET processing_state = 'analyzed', revision = revision + 1 WHERE id = ${id}`;
    await sql`INSERT INTO grouping_overrides (article_id, reason, actor) VALUES (${id}, 'later manual detach', 'test')`;
    const again = await rerun(id, step, key, "test");
    assert.deepEqual(again, first);
    const [state] = await sql`SELECT processing_state FROM articles WHERE id = ${id}`;
    assert.equal(state!.processing_state, "analyzed");
    assert.equal((await sql`SELECT 1 FROM grouping_overrides WHERE article_id = ${id}`).length, 1);
    assert.equal((await sql`SELECT 1 FROM audit_log WHERE request_id = ${key}`).length, 1);
  }
});

test("a rejected SEO correction leaves both the decision and public indexing unchanged", async () => {
  const id = await article();
  await sql`INSERT INTO analyses (article_id, input_revision, origin, relevance, summary_zh, selected)
            VALUES (${id}, 1, 'rule', 'pass', '可收录的正文摘要', false)`;
  await publishArticle(id);
  const [before] = await sql`SELECT seo_indexed_at, seo_excluded_at, indexable FROM publications WHERE article_id = ${id}`;
  await sql.unsafe(`CREATE FUNCTION refuse_admin_seo_audit() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.actor = 'test-refuse-seo' THEN RAISE EXCEPTION 'audit unavailable'; END IF; RETURN NEW; END $$`);
  await sql.unsafe("CREATE TRIGGER refuse_admin_seo_audit BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION refuse_admin_seo_audit()");
  try {
    await assert.rejects(setSeoIndexed(id, { indexed: true, reason: "人工收录" }, "test-refuse-seo"), /audit unavailable/);
    const [after] = await sql`SELECT seo_indexed_at, seo_excluded_at, indexable FROM publications WHERE article_id = ${id}`;
    assert.deepEqual(after, before);
  } finally {
    await sql.unsafe("DROP TRIGGER refuse_admin_seo_audit ON audit_log; DROP FUNCTION refuse_admin_seo_audit()");
  }
  await setSeoIndexed(id, { indexed: true, reason: "人工收录" }, "test");
  const [indexed] = await sql`SELECT seo_indexed_at, seo_excluded_at, indexable FROM publications WHERE article_id = ${id}`;
  assert.ok(indexed!.seo_indexed_at);
  assert.equal(indexed!.seo_excluded_at, null);
  assert.equal(indexed!.indexable, true);
  await setSeoIndexed(id, { indexed: false, reason: "取消收录" }, "test");
  const [excluded] = await sql`SELECT seo_indexed_at, seo_excluded_at, indexable FROM publications WHERE article_id = ${id}`;
  assert.equal(excluded!.seo_indexed_at, null);
  assert.ok(excluded!.seo_excluded_at);
  assert.equal(excluded!.indexable, false);
});
