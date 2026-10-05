import { tag } from "./setup.ts";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { closeDb, sql } from "@aihot/backend/db";
import { stopBoss } from "@aihot/backend/jobs/queue";
import { upsertMaterial } from "@aihot/backend/content/materials";
import { PolicyFactsSchema } from "@aihot/backend/content/policy";
import { overrideFields, setVisibility } from "@aihot/backend/admin/content";
import { loadItemDetail } from "@aihot/backend/publication/detail";
import { loadPool } from "@aihot/backend/publication/pool";
import { loadTopicDirectory, loadTopicPage } from "@aihot/backend/publication/topics";
import { publishArticle } from "@aihot/backend/publication/publish";
import { buildApp } from "../apps/api/src/app.ts";

const T = tag();
const sourceId = `policy-facts-${T}`;
const policyTopic = `policy-facts-topic-${T}`;
const app = await buildApp();
await sql`INSERT INTO sources(id,name,kind,tier,first_party) VALUES(${sourceId},'Verified policy test','rss','T1',true)`;
await sql`INSERT INTO topics(slug,name,grp,tags,definition,position) VALUES(${policyTopic},'Policy test','field',${[T]},'Test scope',9999)`;
after(async () => {
  await sql`DELETE FROM articles WHERE source_id = ${sourceId}`;
  await sql`DELETE FROM sources WHERE id = ${sourceId}`;
  await sql`DELETE FROM topics WHERE slug = ${policyTopic}`;
  await app.close();
  await stopBoss();
  await closeDb();
});

async function reviewed(name: string, issuer: string, selected = false, category = "policy", region = "中国") {
  const material = await upsertMaterial({ sourceId, url: `https://official.example/${T}/${name}`, title: `测试政策 ${name}`,
    bodyText: "已核对的官方正文", bodyStatus: "ok", via: "fetch", publishedAt: new Date(Date.now() - 60_000), backfill: "first-import" });
  await sql`UPDATE articles SET grouped_at = now() - interval '1 second' WHERE id = ${material.articleId}`;
  const facts = PolicyFactsSchema.parse({ sourceRevision: 1, verifiedAt: "2026-10-03", issuers: [issuer], region,
    documentNumber: `测试规章 ${name}`, documentType: "通知", stage: "正式文件", legalStatus: "待生效",
    legalStatusAsOf: "2026-10-03", effectiveAt: "2026-11-01", implementationStatus: "未核实", keyPoints: ["明确适用对象"],
    attachments: [{ title: "官方附件", url: `https://official.example/${T}/${name}.pdf` }] });
  await overrideFields(material.articleId, { version: 0, reason: "已核对官方事实", fields: {
    title: `测试政策 ${name}`, summary: "官方政策事实，不作价格预测。", category, tags: [T], relevance: "pass", selected, policy: facts,
  } }, "policy-review-test");
  return material.articleId;
}

test("policy facts reject malformed dates, unsafe links and mixed process/validity states", () => {
  for (const invalid of [
    { effectiveAt: "2026-02-30" }, { stage: "已生效" }, { legalStatus: "政策执行" },
    { attachments: [{ title: "附件", url: "javascript:alert(1)" }] },
    { attachments: [{ title: "附件", url: "https://user:password@official.example/a" }] },
    { sourceRevision: 0 }, { madeUp: "fact" },
  ]) assert.equal(PolicyFactsSchema.safeParse(invalid).success, false);
  const unknown = PolicyFactsSchema.parse({ stage: "征求意见", legalStatus: "未知", implementationStatus: "未核实" });
  assert.equal(unknown.effectiveAt, undefined);
  assert.deepEqual(unknown.keyPoints, []);
  assert.equal(PolicyFactsSchema.safeParse({ effectiveAt: "2028-02-29" }).success, true);
});

test("verified facts and manual authorship use the audited projection, and withdrawn relationships disappear", async () => {
  const id = await reviewed("main", "监管机构 A");
  const related = await reviewed("execution", "监管机构 A", false, "capital-flow");
  const facts = PolicyFactsSchema.parse({ issuers: ["监管机构 A"], sourceRevision: 1,
    stage: "正式文件", legalStatus: "待生效", effectiveAt: "2026-11-01", implementationStatus: "未核实",
    relations: [{ kind: "执行证据", articleId: related, title: "旧标题", url: "https://official.example/wrong" }],
  });
  await overrideFields(id, { version: 1, reason: "核实文件关联", fields: { policy: facts } }, "policy-review-test");
  const detail = await loadItemDetail(id);
  assert.equal(detail.kind, "found");
  if (detail.kind !== "found") return;
  assert.equal(detail.detail.editorialOrigin, "manual");
  assert.equal(detail.detail.score, null);
  assert.equal(detail.detail.policy?.legalStatus, "待生效");
  assert.equal(detail.detail.policy?.implementationStatus, "未核实");
  assert.equal(detail.detail.policy?.relations[0]?.title, "测试政策 execution");
  assert.equal(detail.detail.policy?.relations[0]?.url, `https://official.example/${T}/execution`);
  assert.equal((await sql`SELECT 1 FROM analyses WHERE article_id = ${id}`).length, 0);
  assert.equal((await sql`SELECT 1 FROM audit_log WHERE subject = ${`content:${id}`} AND action = 'content.override'`).length, 2);

  await setVisibility(related, { visibility: "withdrawn", version: 1, reason: "官方撤回" }, "policy-review-test");
  const withdrawn = await loadItemDetail(id);
  assert.equal(withdrawn.kind, "found");
  if (withdrawn.kind === "found") assert.deepEqual(withdrawn.detail.policy?.relations, []);
  assert.equal((await loadItemDetail(related)).kind, "not_found");
  await setVisibility(id, { visibility: "summary-only", version: 2, reason: "仅保留摘要" }, "policy-review-test");
  const limited = await loadItemDetail(id);
  if (limited.kind === "found") assert.equal(limited.detail.policy, null);
});

test("revised originals hide old verified facts immediately and cannot accept a stale review", async () => {
  const id = await reviewed("revision", "修订机构");
  const revision = await upsertMaterial({ sourceId, url: `https://official.example/${T}/revision`, title: "测试政策 revision 修订",
    bodyText: "新修订官方正文已经变化", bodyStatus: "ok", via: "fetch", publishedAt: new Date(Date.now() - 60_000) });
  assert.equal(revision.articleId, id);
  assert.equal((await sql`SELECT revision FROM articles WHERE id = ${id}`)[0]!.revision, 2);
  const stale = await loadItemDetail(id);
  assert.equal(stale.kind, "found");
  if (stale.kind === "found") assert.equal(stale.detail.policy, null, "read guard acts before republish");
  const filtered = await loadPool({ channel: "all", category: "policy", tag: T, issuers: ["修订机构"], now: new Date() });
  assert.equal(filtered.total, 0);
  assert.equal(filtered.policyFacets?.issuers.includes("修订机构"), false);
  await assert.rejects(overrideFields(id, { version: 1, reason: "过期审核", fields: { policy: { sourceRevision: 1, issuers: ["修订机构"] } } }, "policy-review-test"), { code: "conflict" });
  assert.equal((await sql`SELECT version FROM editorial_overrides WHERE article_id = ${id}`)[0]!.version, 1);
  await publishArticle(id);
  assert.equal((await sql`SELECT policy FROM publications WHERE article_id = ${id}`)[0]!.policy, null);
  assert.equal((await sql`SELECT fields->'policy'->>'sourceRevision' AS revision FROM editorial_overrides WHERE article_id = ${id}`)[0]!.revision, "1");
  await overrideFields(id, { version: 1, reason: "重新核对当前修订", fields: { policy: { sourceRevision: 2, issuers: ["修订机构"], legalStatus: "未知" } } }, "policy-review-test");
  const updated = await loadItemDetail(id);
  if (updated.kind === "found") assert.equal(updated.detail.policy?.sourceRevision, 2);
});

test("policy filters combine OR within a dimension and AND across dimensions while preserving search and pagination", async () => {
  const expected: string[] = [];
  for (let i = 0; i < 42; i++) expected.push(await reviewed(`combined-${i}`, i % 2 ? "机构乙" : "机构甲"));
  await reviewed("other-issuer", "机构丙");
  await reviewed("other-region", "机构甲", false, "policy", "全球");
  await reviewed("other-category", "机构甲", false, "first-hand");
  const query = { channel: "firstParty" as const, category: "policy" as const, tag: T,
    issuers: ["机构甲", "机构乙"], regions: ["中国"], stages: ["正式文件"], documentTypes: ["通知"], q: "测试政策 combined", now: new Date() };
  const head = await loadPool(query);
  const tail = await loadPool({ ...query, page: 2, tab: "relevance" });
  assert.equal(head.total, 42);
  assert.equal(head.pageCount, 2);
  assert.equal(head.items.length, 40);
  assert.equal(tail.items.length, 2);
  assert.deepEqual(head.filters.issuers, ["机构甲", "机构乙"]);
  assert.ok(head.policyFacets?.issuers.includes("机构丙"), "facets describe the policy corpus rather than the narrowed result");
  const search = new URLSearchParams({ channel: "firstParty", category: "policy", tag: T, region: "中国", stage: "正式文件", documentType: "通知", q: "测试政策 combined", page: "2" });
  search.append("issuer", "机构甲"); search.append("issuer", "机构乙");
  const response = await app.inject({ method: "GET", url: `/api/site/pool?${search}` });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().total, 42);
  assert.equal(response.json().items.length, 2);
  assert.deepEqual(response.json().filters.issuers, ["机构乙", "机构甲"]);
  assert.equal(response.json().filters.channel, "firstParty");
  const invalid = new URLSearchParams({ category: "policy" });
  for (let i = 0; i < 11; i++) invalid.append("issuer", `${i}`);
  assert.equal((await app.inject({ method: "GET", url: `/api/site/pool?${invalid}` })).statusCode, 400);
});

test("policy topics default to policy all, expose both counts and keep selected as a separate view", async () => {
  const selected = await reviewed("topic-selected", "专题机构", true);
  await reviewed("topic-unselected", "专题机构");
  await reviewed("topic-disclosure", "专题机构", true, "first-hand");
  const now = new Date();
  const directory = await loadTopicDirectory(now);
  const summary = directory.topics.find((topic) => topic.slug === policyTopic)!;
  const all = await loadTopicPage(policyTopic, 1, now);
  const curated = await loadTopicPage(policyTopic, 1, now, { view: "selected", category: "policy" });
  assert.ok(all && curated);
  assert.equal(all.category, "policy");
  assert.equal(all.view, "all");
  assert.equal(all.topic.total, summary.allCount);
  assert.equal(all.topic.allCount, summary.allCount);
  assert.equal(all.topic.selectedCount, summary.selectedCount);
  assert.equal(curated.topic.total, summary.selectedCount);
  assert.equal(curated.items.some((item) => item.id === selected), true);
  assert.equal(curated.items.every((item) => item.category === "policy" && item.selected), true);
  assert.equal(all.items.every((item) => item.category === "policy"), true);
  assert.equal(summary.selectedCount, 1, "disclosures with the same tag stay outside policy topics");
});
