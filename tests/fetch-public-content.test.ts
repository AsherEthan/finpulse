// Explicit false wins over collector defaults and old extraction jobs. All HTTP in this test is a
// local fixture; metadata reads may still fill a date/excerpt without preserving the article body.
import { gate, tag } from "./setup.ts";
import assert from "node:assert/strict";
import http from "node:http";
import { after, test } from "node:test";
import { config } from "@aihot/backend/config";
import { closeDb, sql } from "@aihot/backend/db";
import { stopBoss } from "@aihot/backend/jobs/queue";
import { queueProcessing } from "@aihot/backend/jobs/content";
import { collectSource } from "@aihot/backend/sources/collect";
import { extractArticleBody } from "@aihot/backend/content/extract";
import { loadAnalyzeInput } from "@aihot/backend/editorial/input";
import { waitsForPage } from "@aihot/backend/editorial/analyze";

const T = tag();
const BODY = "The company disclosed monthly production volumes, capacity utilization and its original statistical definitions. ".repeat(12);
const reads = new Map<string, number>();
const requested = gate();
const release = gate();
const sources: string[] = [];
const server = http.createServer(async (req, res) => {
  const path = req.url ?? "";
  reads.set(path, (reads.get(path) ?? 0) + 1);
  if (path.startsWith("/list/")) {
    const name = path.slice(6);
    res.writeHead(200, { "content-type": "text/html" });
    res.end(`<html><body><ul><li><a href="/article/${name}">测试披露 ${name}</a></li></ul></body></html>`);
  } else if (path === "/feed") {
    res.writeHead(200, { "content-type": "application/rss+xml" });
    res.end(`<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title>Fixture</title><item><title>官方自带正文</title><link>${base}/article/rss</link><content:encoded><![CDATA[<p>${BODY}</p>]]></content:encoded></item></channel></rss>`);
  } else if (path === "/json") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify([{ title: "接口自带正文", url: `${base}/article/json`, summary: BODY }]));
  } else {
    if (path === "/article/in-flight") { requested.open(); await release.promise; }
    res.writeHead(200, { "content-type": "text/html" });
    res.end(`<html><head><meta name="description" content="官方短摘要"></head><body><time datetime="2026-10-02T04:00:00Z">2026-10-02</time><article><h1>公司经营披露</h1><p>${BODY}</p></article></body></html>`);
  }
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
config.allowPrivateNetworkFetch = true;
after(async () => {
  release.open();
  await sql`DELETE FROM pgboss.job WHERE data->>'articleId' IN (SELECT id FROM articles WHERE source_id = ANY(${sources}::text[]))`;
  await sql`DELETE FROM articles WHERE source_id = ANY(${sources}::text[])`;
  await sql`DELETE FROM sources WHERE id = ANY(${sources}::text[])`;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await stopBoss();
  await closeDb();
});

async function collect(name: string, options: Record<string, unknown>, kind = "web_list") {
  const sourceId = `fetch-body-${name}-${T}`;
  sources.push(sourceId);
  const sourceConfig = kind === "web_list" ? {
    url: `${base}/list/${name}`, parseMode: "html", itemSelector: "li", linkSelector: "a", titleSelector: "a", ...options,
  } : options;
  await sql`INSERT INTO sources(id,name,kind,tier,config,cursor) VALUES(${sourceId},${name},${kind},'T1',${sql.json(sourceConfig as never)},${sql.json({ initializedAt: new Date().toISOString() })})`;
  const result = await collectSource(sourceId, { force: true, publicOnly: true });
  assert.equal(result.status, "ok", result.error ?? "collection succeeded");
  const [article] = await sql`SELECT id, excerpt, published_at, body_text, body_html, body_status, revision FROM articles WHERE source_id = ${sourceId}`;
  assert.ok(article);
  return { sourceId, article };
}

async function queuedName(articleId: string) {
  const id = await queueProcessing(articleId);
  const [job] = id
    ? await sql`SELECT name FROM pgboss.job WHERE id = ${id}`
    : await sql`SELECT name FROM pgboss.job WHERE data->>'articleId' = ${articleId} ORDER BY created_on DESC LIMIT 1`;
  return job?.name;
}

test("explicit false suppresses bare-page extraction, stale tasks and analysis waits", async () => {
  const { sourceId, article } = await collect("disabled", { fetchPublicContent: false });
  assert.deepEqual([article.body_text, article.body_html, article.body_status], [null, null, "pending"]);
  assert.equal(reads.get("/article/disabled") ?? 0, 0);
  assert.equal(await queuedName(article.id), "content.analyze");
  assert.equal(await extractArticleBody(article.id, true), "skipped", "even a directly invoked old task refuses extraction");
  assert.equal(reads.get("/article/disabled") ?? 0, 0);
  const input = (await loadAnalyzeInput(article.id))!;
  assert.equal(input.source.fetchPublicContent, false);
  assert.equal(input.source.fetchesBody, false);
  assert.equal(waitsForPage(input), false);
  assert.equal(waitsForPage({ ...input, source: { ...input.source, fetchPublicContent: undefined } }), true);
  await sql`UPDATE sources SET config = config || '{"fetchPublicContent":true}'::jsonb WHERE id = ${sourceId}`;
  await sql`DELETE FROM pgboss.job WHERE data->>'articleId' = ${article.id}`;
  assert.equal(await queuedName(article.id), "content.extract-body");
  await sql`UPDATE sources SET config = config || '{"fetchPublicContent":false}'::jsonb WHERE id = ${sourceId}`;
  assert.equal(await extractArticleBody(article.id, false), "skipped", "an extraction queued under the old config rechecks it");
  assert.equal(reads.get("/article/disabled") ?? 0, 0);
});

test("disabled detail enrichment fills the date and short excerpt without storing body bytes", async () => {
  const { article } = await collect("metadata", { fetchPublicContent: false,
    detail: { maxFetches: 1, summarySelector: 'meta[name="description"]', publishedAtSelector: "time", publishedAtAuthoritative: true } });
  assert.equal(reads.get("/article/metadata"), 1);
  assert.equal(article.excerpt, "官方短摘要");
  assert.equal(article.published_at.toISOString(), "2026-10-02T04:00:00.000Z");
  assert.deepEqual([article.body_text, article.body_html, article.body_status, article.revision], [null, null, "pending", 1]);
  assert.equal((await sql`SELECT 1 FROM article_revisions WHERE article_id = ${article.id} AND body_text IS NOT NULL`).length, 0);
  assert.equal(await extractArticleBody(article.id, false), "skipped");
  assert.equal(reads.get("/article/metadata"), 1);
  assert.equal(await queuedName(article.id), "content.analyze");
});

test("RSS and JSON inline bodies remain usable under false without article-page requests", async () => {
  const rss = await collect("rss", { feedUrl: `${base}/feed`, fetchPublicContent: false }, "rss");
  const json = await collect("json", { url: `${base}/json`, itemsPath: "", titlePaths: ["title"], summaryPaths: ["summary"], summaryIsBody: true, urlTemplate: "{url}", fetchPublicContent: false }, "json_list");
  for (const { article } of [rss, json]) {
    assert.ok(article.body_text.includes("statistical definitions"));
    assert.equal(article.body_status, "ok");
    assert.equal(await queuedName(article.id), "content.analyze");
    assert.equal(await extractArticleBody(article.id, false), "skipped");
    assert.equal(waitsForPage((await loadAnalyzeInput(article.id))!), false);
  }
  assert.equal(reads.get("/article/rss") ?? 0, 0);
  assert.equal(reads.get("/article/json") ?? 0, 0);
});

test("omitted and true flags retain normal page fetching and metadata body reuse", async () => {
  for (const [name, options] of [["default", {}], ["enabled", { fetchPublicContent: true }]] as const) {
    const { article } = await collect(name, options);
    assert.equal(await queuedName(article.id), "content.extract-body");
    assert.equal(waitsForPage((await loadAnalyzeInput(article.id))!), true);
    assert.equal(await extractArticleBody(article.id, false), "ok");
    assert.equal(reads.get(`/article/${name}`), 1);
    const [stored] = await sql`SELECT body_status, body_text, revision FROM articles WHERE id = ${article.id}`;
    assert.equal(stored!.body_status, "ok");
    assert.ok(stored!.body_text.includes("statistical definitions"));
    assert.equal(stored!.revision, 2);
  }
  const { article } = await collect("default-detail", { detail: { maxFetches: 1, summarySelector: 'meta[name="description"]', publishedAtSelector: "time" } });
  assert.equal(article.body_status, "ok");
  assert.ok(article.body_text.includes("statistical definitions"));
  assert.equal(reads.get("/article/default-detail"), 1);
});

test("a disabled source cannot save the result of extraction already in flight", async () => {
  const { sourceId, article } = await collect("in-flight", { fetchPublicContent: true });
  const extraction = extractArticleBody(article.id, false);
  await requested.promise;
  await sql`UPDATE sources SET config = config || '{"fetchPublicContent":false}'::jsonb WHERE id = ${sourceId}`;
  release.open();
  assert.equal(await extraction, "skipped");
  const [stored] = await sql`SELECT body_text, body_html, body_status, revision FROM articles WHERE id = ${article.id}`;
  assert.deepEqual([stored!.body_text, stored!.body_html, stored!.body_status, stored!.revision], [null, null, "pending", 1]);
  assert.equal(await queuedName(article.id), "content.analyze");
});
