import { tag } from "./setup.ts";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { closeDb, sql } from "@aihot/backend/db";
import { overrideFields, setVisibility } from "@aihot/backend/admin/content";
import { upsertMaterial } from "@aihot/backend/content/materials";
import { stopBoss } from "@aihot/backend/jobs/queue";
import { loadSourceCatalog, publicSourceUrl } from "@aihot/backend/publication/sources";
import { buildApp } from "../apps/api/src/app.ts";

const T = tag();
const SOURCE = `source-catalog-${T}`;
const PAUSED = `${SOURCE}-paused`;
const SIGNAL = `${SOURCE}-signal`;
const ISOLATED = `${SOURCE}-isolated`;
const IDS = [SOURCE, PAUSED, SIGNAL, ISOLATED];
const SECRET = `PRIVATE-CATALOG-${T}`;
const now = new Date();
const app = await buildApp();
await sql`INSERT INTO sources(id,name,kind,config,tags,first_party,tier,participation_mode,enabled,interval_minutes,last_fetch_at,last_ok_at,last_error,cursor)
  VALUES (${SOURCE},'公开信源','json_list',${sql.json({ url: `https://official.example/list?unusual=${SECRET}#${SECRET}`, headers: { Authorization: `Bearer ${SECRET}` }, _aihot: { sourceDimension: 'research', licenceEvidence: SECRET } })},
    ARRAY['论文',${`entity:${SECRET}`}],true,'T1','editorial',true,120,${now},${now},${SECRET},${sql.json({ token: SECRET })}),
  (${PAUSED},'暂停信源','rss',${sql.json({ feedUrl: 'https://official.example/feed.xml?apiKey=hidden' })},ARRAY['政策/监管'],false,'T2','editorial',false,180,NULL,NULL,NULL,NULL),
  (${SIGNAL},'热度信源','x_search',${sql.json({ query: `from:account ${SECRET}`, _aihot: { sourceDimension: 'signal' } })},ARRAY['资金/流动性'],false,'T2','hot_signal',true,60,NULL,NULL,NULL,NULL),
  (${ISOLATED},'隔离信源','web_list',${sql.json({ url: 'https://private.example/' })},ARRAY['政策/监管'],false,'T2','isolated',true,60,NULL,NULL,NULL,NULL)`;
await sql`INSERT INTO fetch_runs(source_id,status,started_at,new_count,error,detail)
  VALUES(${SOURCE},'ok',${now},1,${SECRET},${sql.json({ requestHeaders: SECRET })})`;

after(async () => {
  await sql`DELETE FROM selected_ledger WHERE article_id IN (SELECT id FROM articles WHERE source_id IN ${sql(IDS)})`;
  await sql`DELETE FROM selected_state WHERE article_id IN (SELECT id FROM articles WHERE source_id IN ${sql(IDS)})`;
  await sql`DELETE FROM articles WHERE source_id IN ${sql(IDS)}`;
  await sql`DELETE FROM sources WHERE id IN ${sql(IDS)}`;
  await app.close();
  await stopBoss();
  await closeDb();
});

test("source directory excludes isolated sources, keeps paused and heat sources, and exposes only safe fields", async () => {
  const data = await loadSourceCatalog(now);
  assert.equal(data.generatedAt, now.toISOString());
  assert.ok(!data.sources.some((s) => s.id === ISOLATED));
  const source = data.sources.find((s) => s.id === SOURCE)!;
  assert.deepEqual(source, {
    id: SOURCE, name: '公开信源', url: 'https://official.example/list', tags: ['论文'], sourceDimension: 'research',
    firstParty: true, tier: 'T1', enabled: true, intervalMinutes: 120, state: 'ok',
    lastSuccessAt: now.toISOString(), lastAttemptAt: now.toISOString(), publishedCount: 0,
  });
  assert.equal(data.sources.find((s) => s.id === PAUSED)!.state, 'paused');
  assert.equal(data.sources.find((s) => s.id === PAUSED)!.url, 'https://official.example/feed.xml');
  const signal = data.sources.find((s) => s.id === SIGNAL)!;
  assert.equal(signal.state, 'never_collected');
  assert.equal(signal.sourceDimension, 'signal');
  assert.equal(signal.url, null);
  assert.equal(JSON.stringify(data).includes(SECRET), false);
  for (const key of ['config','cursor','last_error','error','detail','headers','licenceEvidence']) {
    assert.equal(Object.hasOwn(source, key), false, key);
  }
});

test("directory URLs reject credentials and unsafe schemes, and never retain query or fragment values", () => {
  for (const url of [undefined, {}, 'not a URL', 'javascript:alert(1)', 'file:///tmp/private',
    'https://user:password@official.example/list', 'https://official.example/auth/private',
    'https://official.example/path/Bearer%20private', 'https://official.example/api_key/private']) {
    assert.equal(publicSourceUrl(url), null, String(url));
  }
  assert.equal(publicSourceUrl('http://official.example/list?page=2&authorization=secret#secret'), 'http://official.example/list');
  assert.equal(publicSourceUrl('https://official.example/中国/?custom_secret=secret'), 'https://official.example/%E4%B8%AD%E5%9B%BD/');
});

async function article(name: string, patch: Record<string, unknown> = {}, visibility?: 'summary-only' | 'withdrawn') {
  const { articleId } = await upsertMaterial({ sourceId: SOURCE, url: `https://official.example/${T}/${name}`,
    title: `目录计数 ${name}`, bodyStatus: 'none', via: 'fetch', publishedAt: new Date(now.getTime() - 60_000) });
  await overrideFields(articleId, { version: 0, reason: '目录可见性测试', fields: {
    title: `目录计数 ${name}`, summary: '仅供本地测试的公开摘要。', relevance: 'pass', category: 'first-hand', selected: false, ...patch,
  } }, 'catalog-test');
  if (visibility) await setVisibility(articleId, { version: 1, visibility, reason: '目录可见性测试' }, 'catalog-test');
  return articleId;
}

test("published count follows public eligibility, withdrawal and the selected release gate", async () => {
  await article('listed');
  await article('summary-only', {}, 'summary-only');
  await article('withdrawn', {}, 'withdrawn');
  await article('ineligible', { relevance: 'block' });
  const gated = await article('pending-selected', { selected: true });
  const [publication] = await sql<{ visible_after: Date }[]>`SELECT visible_after FROM publications WHERE article_id = ${gated}`;
  assert.ok(publication!.visible_after.getTime() > now.getTime());
  assert.equal((await loadSourceCatalog(now)).sources.find((s) => s.id === SOURCE)!.publishedCount, 1);
  const releasedAt = new Date(publication!.visible_after.getTime() + 1000);
  assert.equal((await loadSourceCatalog(releasedAt)).sources.find((s) => s.id === SOURCE)!.publishedCount, 2);
});

test("anonymous catalog reads support ETags; writes still require the administrator API", async () => {
  const [before] = await sql`SELECT config,enabled,updated_at,cursor,last_fetch_at FROM sources WHERE id = ${SOURCE}`;
  const first = await app.inject({ method: 'GET', url: '/api/site/sources' });
  assert.equal(first.statusCode, 200, first.body);
  assert.ok(first.json().sources.some((s: { id: string }) => s.id === SOURCE));
  assert.equal(first.body.includes(SECRET), false);
  assert.equal(first.headers['cache-control'], 'public, max-age=30, s-maxage=30');
  assert.ok(first.headers.etag);
  const cached = await app.inject({ method: 'GET', url: '/api/site/sources', headers: { 'if-none-match': String(first.headers.etag) } });
  assert.equal(cached.statusCode, 304);
  assert.equal(cached.body, '');
  for (const method of ['POST', 'PATCH', 'DELETE'] as const) {
    const response = await app.inject({ method, url: '/api/site/sources', payload: { enabled: false } });
    assert.equal(response.statusCode, 404, method);
  }
  const unauthenticated = await app.inject({ method: 'PATCH', url: `/api/admin/sources/${SOURCE}`, payload: { patch: { enabled: false }, version: before!.updated_at.toISOString() } });
  assert.equal(unauthenticated.statusCode, 401);
  const [afterRead] = await sql`SELECT config,enabled,updated_at,cursor,last_fetch_at FROM sources WHERE id = ${SOURCE}`;
  assert.deepEqual(afterRead, before);
});
