// Explicit review is independent of source ownership, tier and manual writing. Changed originals
// invalidate checks at every public read, including old synchronization entries, before republishing.
import { tag } from "./setup.ts";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import type { InformationProfile } from "@aihot/contracts/site";
import { closeDb, sql } from "@aihot/backend/db";
import { stopBoss } from "@aihot/backend/jobs/queue";
import { overrideFields } from "@aihot/backend/admin/content";
import { upsertMaterial } from "@aihot/backend/content/materials";
import { InformationProfileSchema, publicInformationProfile, sourceDimension } from "@aihot/backend/content/information";
import { unsupportedConfig } from "@aihot/backend/sources/config-keys";
import { publishArticle } from "@aihot/backend/publication/publish";
import { effectiveWatermark, selectedChanges, selectedSnapshot } from "@aihot/backend/publication/v1";
import { buildApp } from "../apps/api/src/app.ts";

const T = tag();
const SOURCE = `information-profile-${T}`;
const OTHER = `${SOURCE}-original`;
const BODY = "公司披露产销量与统计口径，数据以公告为准。".repeat(30);
const CHECKED: InformationProfile = { contentNature: "fact", verificationStatus: "original_checked", sourceRevision: 1, checkedAt: "2026-10-03T00:00:00Z" };
const app = await buildApp();
const stories: number[] = [];
await sql`INSERT INTO sources(id,name,kind,tier,first_party,config,site_fulltext,syndicate_fulltext)
  VALUES(${SOURCE},'Own research example','web_list','T1',true,${sql.json({ _aihot: { sourceDimension: "secondary" }, headers: { Authorization: `PRIVATE-${T}` } })},true,false),
  (${OTHER},'Official statistics example','rss','T2',false,${sql.json({ _aihot: { sourceDimension: "original" } })},true,false)`;
after(async () => {
  await sql`DELETE FROM selected_ledger WHERE article_id IN (SELECT id FROM articles WHERE source_id IN (${SOURCE},${OTHER}))`;
  await sql`DELETE FROM selected_state WHERE article_id IN (SELECT id FROM articles WHERE source_id IN (${SOURCE},${OTHER}))`;
  await sql`DELETE FROM articles WHERE source_id IN (${SOURCE},${OTHER})`;
  await sql`DELETE FROM sources WHERE id IN (${SOURCE},${OTHER})`;
  for (const id of stories) {
    await sql`DELETE FROM facts WHERE story_id = ${id}`;
    await sql`DELETE FROM stories WHERE id = ${id}`;
  }
  await app.close();
  await stopBoss();
  await closeDb();
});

async function item(name: string, profile?: InformationProfile, source = SOURCE, selected = true) {
  const url = `https://official.example/${T}/${name}`;
  const { articleId } = await upsertMaterial({ sourceId: source, url, title: `信息测试 ${name}`, bodyText: BODY,
    bodyHtml: `<p>${BODY}</p>`, bodyStatus: "ok", via: "fetch", publishedAt: new Date(Date.now() - 1000) });
  await sql`UPDATE articles SET grouped_at = now() - interval '1 second' WHERE id = ${articleId}`;
  await overrideFields(articleId, { version: 0, reason: "人工阅读并标注", fields: {
    title: `信息测试 ${name}`, summary: "原文说明已披露统计期间，不含预测。", category: "supply-chain", tags: [T],
    relevance: "pass", selected, ...(profile ? { informationProfile: profile } : {}),
  } }, "review-test");
  return { id: articleId, url };
}

async function json(url: string) {
  const response = await app.inject({ method: "GET", url });
  assert.equal(response.statusCode, 200, response.body);
  return response.json();
}

// Other test files can leave a selected entry awaiting release. The sync's prefix watermark must
// keep that gate. Read through the same public functions at an explicit future clock instead of
// rewriting their entries or relying on the shared database having no pending release.
async function syncClock(): Promise<Date> {
  const [row] = await sql<{ at: Date }[]>`SELECT greatest(coalesce(max(visible_at), now()), now()) AS at FROM selected_ledger`;
  return new Date(row!.at.getTime() + 1000);
}

async function snapshot(fields: "default" | "minimal") {
  return selectedSnapshot({ fields, limit: 1000, page: null }, await syncClock());
}

async function changes(cursor: string) {
  return selectedChanges({ cursor, limit: 100 }, await syncClock());
}

test("source classification and review schemas validate independent dimensions and whitelist stored fields", () => {
  assert.equal(sourceDimension("secondary", true), "secondary");
  assert.equal(sourceDimension("original", false), "original");
  assert.equal(sourceDimension(undefined, true), "original");
  assert.equal(sourceDimension(undefined, false), "secondary");
  for (const kind of ["rss", "web_list", "json_list", "mp_account", "external"] as const) {
    assert.deepEqual(unsupportedConfig(kind, { _aihot: { sourceDimension: "research" } }), []);
    assert.deepEqual(unsupportedConfig(kind, { _aihot: { sourceDimension: "credible" } }), ["_aihot.sourceDimension"]);
  }
  for (const value of [{ ...CHECKED, sourceRevision: 0 }, { ...CHECKED, contentNature: "mixed" },
    { ...CHECKED, verificationStatus: "fact_confirmed" }, { ...CHECKED, checkedAt: "2026-02-30" },
    { ...CHECKED, actor: "private" }, { contentNature: "fact", verificationStatus: "original_checked" }]) {
    assert.equal(InformationProfileSchema.safeParse(value).success, false);
    assert.equal(publicInformationProfile(value, 1), null);
  }
  assert.deepEqual(publicInformationProfile(CHECKED, 2), { contentNature: "unknown", verificationStatus: "pending", sourceRevision: 2 });
});

test("manual writing never supplies a content verdict or check; source tier and ownership remain independent", async () => {
  const manual = await item("manual");
  const other = await item("external-original", undefined, OTHER, false);
  const detail = await json(`/api/site/items/${manual.id}`);
  assert.equal(detail.editorialOrigin, "manual");
  assert.equal(detail.informationProfile, null);
  assert.equal(detail.source.firstParty, true);
  assert.equal(detail.source.sourceDimension, "secondary");
  assert.equal(detail.source.tier, "T1");
  const original = await json(`/api/site/items/${other.id}`);
  assert.equal(original.source.firstParty, false);
  assert.equal(original.source.sourceDimension, "original");
  assert.equal(original.source.tier, "T2");
  assert.equal(original.informationProfile, null);
  const unknown = await json(`/api/site/pool?tag=${T}&nature=unknown&verification=pending`);
  assert.ok(unknown.items.some((row: any) => row.id === manual.id));
  assert.ok(unknown.items.some((row: any) => row.id === other.id));
  assert.equal(JSON.stringify(detail).includes(`PRIVATE-${T}`), false);
  assert.equal(JSON.stringify(detail).includes("headers"), false);
});

test("an explicit review changes projection and ordered sync; unchanged review does not change freshness", async () => {
  const { id } = await item("profile-projection");
  const before = (await sql`SELECT revision FROM publications WHERE article_id = ${id}`)[0]!.revision;
  const first = await overrideFields(id, { version: 1, reason: "逐条核对当前原文", fields: { informationProfile: CHECKED } }, "review-test");
  assert.equal(first?.changed, true);
  assert.equal(first?.ledger, "upsert");
  const [projected] = await sql`SELECT revision, information_profile, updated_at FROM publications WHERE article_id = ${id}`;
  assert.equal(projected!.revision, before + 1);
  assert.deepEqual(projected!.information_profile, CHECKED);
  const unchanged = await publishArticle(id);
  assert.equal(unchanged?.changed, false);
  assert.equal(unchanged?.ledger, null);
  assert.deepEqual((await sql`SELECT updated_at FROM publications WHERE article_id = ${id}`)[0]!.updated_at, projected!.updated_at);
  const detail = await json(`/api/site/items/${id}`);
  assert.deepEqual(detail.informationProfile, CHECKED);
  assert.equal(detail.source.firstParty, true);
  assert.equal(detail.source.sourceDimension, "secondary");
  assert.equal((await sql`SELECT 1 FROM audit_log WHERE subject = ${`content:${id}`} AND action = 'content.override'`).length, 2);
  assert.equal((await sql`SELECT 1 FROM analyses WHERE article_id = ${id}`).length, 0);
});

test("three filters combine with category, search, pool order and timeline scope; invalid parameters fail", async () => {
  const fact = await item("combined-fact", CHECKED);
  await item("combined-opinion", { ...CHECKED, contentNature: "opinion", verificationStatus: "pending" });
  const filters = `tag=${T}&category=supply-chain&sourceType=secondary&nature=fact&verification=original_checked`;
  for (const tab of ["time", "relevance"]) {
    const pool = await json(`/api/site/pool?${filters}&q=combined&tab=${tab}`);
    assert.deepEqual(pool.items.map((row: any) => row.id), [fact.id]);
    assert.equal(pool.filters.sourceType, "secondary");
    assert.deepEqual(pool.items[0].informationProfile, CHECKED);
    assert.equal(pool.items[0].source.firstParty, true, "compact feed retains independent ownership");
  }
  const timeline = await json(`/api/site/timeline?${filters}`);
  assert.ok(JSON.stringify(timeline).includes(fact.id));
  assert.equal(timeline.filters.verification, "original_checked");
  const v1 = await json(`/api/v1/items?mode=all&sourceType=secondary&nature=fact&verification=original_checked&q=combined`);
  assert.deepEqual(v1.items.map((row: any) => row.id), [fact.id]);
  assert.deepEqual(v1.items[0].informationProfile, CHECKED);
  for (const prefix of ["/api/site/pool", "/api/site/timeline", "/api/v1/items"]) {
    for (const parameter of ["sourceType=trusted", "nature=mixed", "verification=confirmed"]) {
      assert.equal((await app.inject({ method: "GET", url: `${prefix}?${parameter}` })).statusCode, 400);
    }
  }
  await item("combined-fact-two", CHECKED);
  const cursor = (await json("/api/v1/items?mode=all&sourceType=secondary&nature=fact&limit=1")).page.nextCursor;
  assert.ok(cursor);
  assert.equal((await app.inject({ method: "GET", url: `/api/v1/items?mode=all&sourceType=secondary&nature=opinion&limit=1&cursor=${encodeURIComponent(cursor)}` })).statusCode, 400);
});

test("sync fixture reads preserve an unrelated pending release and do not require an empty ledger", async () => {
  const { articleId } = await upsertMaterial({ sourceId: SOURCE, url: `https://official.example/${T}/pending-release`,
    title: "仍待归组的披露", bodyText: BODY, bodyStatus: "ok", via: "fetch", publishedAt: new Date() });
  await overrideFields(articleId, { version: 0, reason: "未完成归组的测试披露", fields: {
    title: "仍待归组的披露", summary: "此条目等待发布门禁。", relevance: "pass", category: "supply-chain", selected: true,
  } }, "review-test");
  const [entry] = await sql<{ seq: number; visible_at: Date }[]>`SELECT seq, visible_at FROM selected_ledger WHERE article_id = ${articleId}`;
  assert.ok(entry!.visible_at.getTime() > Date.now());
  assert.ok(await effectiveWatermark() < Number(entry!.seq));
  const current = await selectedSnapshot({ fields: "minimal", limit: 1000, page: null });
  assert.ok(current.items.every((row) => row.id !== articleId), "the real clock still enforces release");
  assert.ok((await snapshot("minimal")).items.some((row) => row.id === articleId), "the explicit read clock is past the release");
  assert.deepEqual((await sql`SELECT visible_at FROM selected_ledger WHERE article_id = ${articleId}`)[0]!.visible_at, entry!.visible_at, "no fixture timestamp was rewritten");
});

test("changed originals become unknown and pending across detail, compact, v1, RSS and sync before republish", async () => {
  const entry = await item("changed-original", CHECKED);
  const start = await snapshot("minimal");
  await overrideFields(entry.id, { version: 1, reason: "更新展示标题", fields: { title: "变更前展示标题" } }, "review-test");
  await upsertMaterial({ sourceId: SOURCE, url: entry.url, title: "已修改原文", bodyText: `${BODY}新增统计口径。`,
    bodyStatus: "ok", via: "fetch", publishedAt: new Date(Date.now() - 60_000) });
  const pending = { contentNature: "unknown", verificationStatus: "pending", sourceRevision: 2 };
  assert.deepEqual((await json(`/api/site/items/${entry.id}`)).informationProfile, pending);
  const checked = await json(`/api/site/pool?tag=${T}&nature=fact&verification=original_checked`);
  assert.ok(checked.items.every((row: any) => row.id !== entry.id));
  const pool = await json(`/api/site/pool?tag=${T}&nature=unknown&verification=pending`);
  assert.deepEqual(pool.items.find((row: any) => row.id === entry.id).informationProfile, pending);
  const v1 = await json("/api/v1/items?mode=all&nature=unknown&verification=pending");
  assert.deepEqual(v1.items.find((row: any) => row.id === entry.id).informationProfile, pending);
  const rss = await app.inject({ method: "GET", url: "/feed/all.xml" });
  assert.equal(rss.statusCode, 200);
  const xml = rss.body.split("<item>").find((part) => part.includes(`<guid isPermaLink="false">${entry.id}</guid>`))!;
  assert.ok(xml.includes("<finpulse:nature>unknown</finpulse:nature>"));
  assert.ok(xml.includes("<finpulse:verification>pending</finpulse:verification>"));
  assert.ok(!xml.includes("<finpulse:checkedAt>"));
  const currentSnapshot = await snapshot("minimal");
  assert.deepEqual(currentSnapshot.items.find((row) => row.id === entry.id)?.informationProfile, pending);
  const currentChanges = await changes(start.cursor);
  const changed = currentChanges.changes.find((row) => row.op === "upsert" && row.item.id === entry.id);
  assert.ok(changed?.op === "upsert");
  assert.deepEqual(changed.item.informationProfile, pending);
  await assert.rejects(overrideFields(entry.id, { version: 2, reason: "旧原文审核不可复用", fields: { informationProfile: CHECKED } }, "review-test"), { code: "conflict" });
  assert.equal((await sql`SELECT version FROM editorial_overrides WHERE article_id = ${entry.id}`)[0]!.version, 2);
  await publishArticle(entry.id);
  assert.deepEqual((await sql`SELECT information_profile FROM publications WHERE article_id = ${entry.id}`)[0]!.information_profile, pending);
  await overrideFields(entry.id, { version: 2, reason: "重新阅读当前原文", fields: { informationProfile: { ...CHECKED, sourceRevision: 2 } } }, "review-test");
  assert.equal((await json(`/api/site/items/${entry.id}`)).informationProfile.verificationStatus, "original_checked");
});

test("revision checks preserve each historical sync title and never upgrade an unreviewed historic entry", async () => {
  const start = await snapshot("default");
  const entry = await item("historic-unreviewed");
  await overrideFields(entry.id, { version: 1, reason: "核对并调整标题", fields: { title: "historical-first", informationProfile: CHECKED } }, "review-test");
  await overrideFields(entry.id, { version: 2, reason: "调整标题不重写历史", fields: { title: "historical-second" } }, "review-test");
  const result = await changes(start.cursor);
  const ours = result.changes.filter((row: any) => row.item?.id === entry.id).map((row: any) => row.item);
  assert.deepEqual(ours.map((row: any) => row.title), ["信息测试 historic-unreviewed", "historical-first", "historical-second"]);
  assert.equal(ours[0].informationProfile, null, "a later review cannot bless an older presentation");
  assert.deepEqual(ours[1].informationProfile, CHECKED);
});

test("group and story reports expose the same dimensions and downgrade checks when originals change", async () => {
  const entry = await item("group-report", CHECKED);
  const publicId = randomUUID();
  const [story] = await sql`INSERT INTO stories(public_id,title,first_report_at,latest_at) VALUES(${publicId},'Test review story',now(),now()) RETURNING id`;
  stories.push(story!.id);
  const factPublicId = `information-fact-${T}`;
  const [fact] = await sql`INSERT INTO facts(public_id,story_id,title) VALUES(${factPublicId},${story!.id},'Test review fact') RETURNING id`;
  await sql`INSERT INTO fact_articles(fact_id,article_id,role) VALUES(${fact!.id},${entry.id},'report')`;
  await publishArticle(entry.id);
  const group = await json(`/api/site/groups/${factPublicId}/reports?sourceType=secondary&nature=fact&verification=original_checked`);
  assert.deepEqual(group.reports[0].informationProfile, CHECKED);
  assert.equal(group.reports[0].source.sourceDimension, "secondary");
  const site = await json(`/api/site/stories/${publicId}`);
  const v1 = await json(`/api/v1/stories/${publicId}`);
  assert.deepEqual(site.timeline[0].informationProfile, CHECKED);
  assert.deepEqual(v1.story.reports[0].informationProfile, CHECKED);
  assert.equal(v1.story.reports[0].source.tier, "T1");
  await upsertMaterial({ sourceId: SOURCE, url: entry.url, title: "组内原文修订", bodyText: `${BODY}修订数据。`, bodyStatus: "ok", via: "fetch" });
  assert.equal((await json(`/api/site/stories/${publicId}`)).timeline[0].informationProfile.verificationStatus, "pending");
  assert.equal((await json(`/api/v1/stories/${publicId}`)).story.reports[0].informationProfile.contentNature, "unknown");
  assert.equal((await app.inject({ method: "GET", url: `/api/site/groups/${factPublicId}/reports?verification=original_checked` })).statusCode, 404);
});
