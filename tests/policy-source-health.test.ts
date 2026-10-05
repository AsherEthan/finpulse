import { tag } from "./setup.ts";
import assert from "node:assert/strict";
import http from "node:http";
import { after, test } from "node:test";
import { config } from "@aihot/backend/config";
import { closeDb, sql } from "@aihot/backend/db";
import { stopBoss } from "@aihot/backend/jobs/queue";
import { collectSource, noiseFiltered, scheduleDueSources } from "@aihot/backend/sources/collect";
import { fromSzseRules } from "@aihot/backend/sources/web-list";
import { readListingWindow } from "@aihot/backend/sources/pagination";
import { loadPolicySources, policySourceState, publicSourceFailure } from "@aihot/backend/publication/policy-sources";

const suffix = tag();
const id = `policy-health-${suffix}`;
let fail = false;
let requests = 0;
let officialStatus = 4;
const server = http.createServer((req, res) => {
  requests += 1;
  if (fail) { res.writeHead(503); res.end('private error token=secret'); return; }
  const page = Number(new URL(req.url!, 'http://stub').searchParams.get('page') ?? 1);
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ rows: [1, 2].map((n) => ({ id: (page - 1) * 2 + n, title: `正式金融监管文件 ${page}-${n}`, date: '2026-09-30T08:00:00Z', sxx: officialStatus })) }));
});
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
config.allowPrivateNetworkFetch = true;
after(async () => { await new Promise<void>((resolve) => server.close(() => resolve())); await stopBoss(); await closeDb(); });

test('bounded policy collection distinguishes no update, failure and a never checked source', async () => {
  const sourceConfig = { url: `${base}/list?apiKey=secret`, itemsPath: 'rows', titlePaths: ['title'], publishedAtPath: 'date', urlTemplate: `${base}/policy/{id}`,
    pagination: { pageParam: 'page', maxPages: 2, pageSize: 2 }, rawPaths: ['sxx'], _aihot: { initialBackfillLimit: 8 } };
  await sql`INSERT INTO sources (id, name, kind, config, tags, first_party, interval_minutes, next_fetch_at) VALUES
    (${id}, '监管政策', 'json_list', ${sql.json(sourceConfig)}, ARRAY['政策/监管','金融监管'], true, 120, '2100-01-01'),
    (${`${id}-never`}, '尚未采集', 'web_list', '{}'::jsonb, ARRAY['政策/监管'], true, 120, '2100-01-01')`;
  const first = await collectSource(id, { publicOnly: true });
  assert.equal(first.created, 4);
  assert.equal(requests, 2);
  const [run] = await sql`SELECT * FROM fetch_runs WHERE source_id = ${id} ORDER BY id DESC LIMIT 1`;
  assert.equal(run!.detail.pages, 2);
  assert.equal(run!.detail.truncated, true, 'hitting a nonempty cap is a partial window');
  assert.equal(run!.window_from.toISOString(), '2026-09-30T08:00:00.000Z');
  assert.equal(run!.revised_count, 0);
  const checked = await loadPolicySources();
  const current = checked.sources.find((s) => s.id === id)!;
  assert.equal(current.state, 'ok');
  assert.equal(current.pendingReviewCount, 4);
  assert.equal(current.publishedCount, 0);
  assert.equal(new URL(current.url!).searchParams.has('apiKey'), false, 'public metadata removes credential parameters');
  assert.equal(checked.sources.find((s) => s.id === `${id}-never`)!.state, 'never_collected');

  officialStatus = 3;
  await collectSource(id, { publicOnly: true });
  assert.equal((await loadPolicySources()).sources.find((s) => s.id === id)!.state, 'no_update');
  const [observed] = await sql`SELECT revision, raw FROM articles WHERE source_id = ${id} LIMIT 1`;
  assert.equal(observed!.raw.officialMetadata.sxx, 3, 'official metadata is refreshed even when the text is unchanged');
  assert.equal(observed!.revision, 1, 'metadata does not fabricate a new text revision or public policy fact');
  const success = (await loadPolicySources()).sources.find((s) => s.id === id)!.lastSuccessAt;
  fail = true;
  const failed = await collectSource(id, { publicOnly: true });
  assert.equal(failed.status, 'failed');
  const failedHealth = (await loadPolicySources()).sources.find((s) => s.id === id)!;
  assert.equal(failedHealth.state, 'failed');
  assert.equal(failedHealth.lastSuccessAt, success, 'failure does not move the successful watermark');
  assert.equal(failedHealth.failureReason, '原站返回 HTTP 503');
  assert.ok(failedHealth.lastFailureAt);
  assert.equal(JSON.stringify(failedHealth).includes('secret'), false);
  const [rejected] = await sql`SELECT id FROM articles WHERE source_id = ${id} LIMIT 1`;
  await sql`INSERT INTO editorial_overrides (article_id, fields, updated_by) VALUES (${rejected!.id}, '{"relevance":"block"}'::jsonb, 'test-reviewer')`;
  assert.equal((await loadPolicySources()).sources.find((s) => s.id === id)!.pendingReviewCount, 3, 'materials already rejected by an editor are not awaiting review');
});

test('collection-only boundary and scheduler reject paid and non-HTTP source kinds', async () => {
  for (const [kind, config] of [['x_search', { query: 'from:example' }], ['web_list', { url: 'https://r.jina.ai/https://example.com/list' }]] as const) {
    const sid = `${id}-${kind}`;
    await sql`INSERT INTO sources (id, name, kind, config, next_fetch_at) VALUES (${sid}, ${sid}, ${kind}, ${sql.json(config)}, now())`;
    assert.equal((await collectSource(sid, { force: true, publicOnly: true })).error, 'not_public_http');
    assert.equal(Number((await sql`SELECT count(*)::int AS n FROM fetch_runs WHERE source_id = ${sid}`)[0]!.n), 0);
  }
  const scheduled = await scheduleDueSources(20, { publicOnly: true });
  assert.equal(scheduled.shards, 0);
  const paid = await sql`SELECT id, next_fetch_at FROM sources WHERE id IN (${`${id}-x_search`}, ${`${id}-web_list`})`;
  assert.ok(paid.every((s) => s.next_fetch_at.getTime() <= Date.now()), 'paid sources are never moved into the HTTP queue');
});

test('old publication dates never make a recently checked quiet source stale', () => {
  const now = new Date();
  const row = { enabled: true, last_ok_at: now, last_fetch_at: now, run_status: 'ok', started_at: now, interval_minutes: 120, new_count: 0, revised_count: 0 };
  assert.equal(policySourceState(row, now), 'no_update');
  assert.equal(policySourceState(row, new Date(now.getTime() + 7 * 3_600_000)), 'stale');
  assert.equal(publicSourceFailure('connection failed https://host?token=private'), '原站暂时无法读取');
});

test('SZSE rule links are parsed without executing document.write scripts or guessing dates', () => {
  const html = `<ul class="newslist"><li><div><script>var curHref='./rule/t20260904_1.html'; // old title\nvar curTitle='关于修订公司债券审核规则的通知'; document.write('ignored');</script><span class="time">2026-09-04</span></div></li></ul>`;
  const rows = fromSzseRules(html, 'https://investor.szse.cn/lawrules/', { config: { allowUrlPrefixes: ['https://investor.szse.cn/lawrules/'] } } as never);
  assert.equal(rows[0]!.url, 'https://investor.szse.cn/lawrules/rule/t20260904_1.html');
  assert.equal(rows[0]!.publishedAt!.toISOString(), '2026-09-04T00:00:00.000Z');
  assert.equal(rows[0]!.title, '关于修订公司债券审核规则的通知');
});

test('pagination cannot forward source headers to another origin', async () => {
  await assert.rejects(readListingWindow({ config: { url: 'https://example.com/list', pagination: { urlTemplate: 'https://other.example/list?page={page}', maxPages: 2 } } } as never,
    async () => { throw new Error('should not fetch'); }), /remain on the listing origin/);
});

test('a legal directory uses explicit financial title scope instead of publishing every statute', () => {
  const source = { config: { allowTitleRegex: '金融|银行|证券|保险|经济|企业|公司|税|预算' } } as never;
  assert.equal(noiseFiltered({ title: '中华人民共和国商业银行法', url: 'https://example.org/law' }, source), false);
  assert.equal(noiseFiltered({ title: '中华人民共和国国防动员法', url: 'https://example.org/law' }, source), true);
});
