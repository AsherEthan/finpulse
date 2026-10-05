import { tag } from './setup.ts';
import assert from 'node:assert/strict';
import http from 'node:http';
import { after, test } from 'node:test';
import { config } from '@aihot/backend/config';
import { fetchRss, arxivEntryMetadata } from '@aihot/backend/sources/rss';
import type { SourceRow } from '@aihot/backend/sources/types';
import { sql, closeDb } from '@aihot/backend/db';
import { stopBoss } from '@aihot/backend/jobs/queue';
import { collectSource } from '@aihot/backend/sources/collect';

const entry = (url: string, published = '') => `<entry><id>${url}</id><title>Paper</title><link rel="alternate" href="${url}"/><author><name>Alice</name></author><author><name>Bob</name></author>${published ? `<published>${published}</published>` : ''}<updated>2026-10-02T12:00:00Z</updated><summary>Public abstract</summary></entry>`;
let version = 1;
const fixtureId = tag();
const server = http.createServer((req, res) => {
  if (req.url === '/metadata') {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify([{ url: `https://arxiv.org/abs/2610.01935?fixture=${fixtureId}`, title: 'Unchanged paper', published: '2026-10-01T10:00:00Z', versionUrl: `https://arxiv.org/abs/2610.01935v${version}`, updated: `2026-10-0${version}T12:00:00Z`, authors: version === 1 ? ['Alice'] : ['Alice', 'Bob'] }]));
    return;
  }
  res.setHeader('content-type', 'application/atom+xml');
  res.end(`<feed xmlns="http://www.w3.org/2005/Atom">${req.url === '/versions'
    ? entry('http://arxiv.org/abs/2610.01935v1', '2026-10-01T10:00:00Z') + entry('https://arxiv.org/abs/2610.01935v2', '2026-10-01T10:00:00Z') + entry('https://arxiv.org/abs/hep-th/9901001v3')
    : entry('https://example.org/abs/2610.01935v2') + entry('https://arxiv.org/other/2610.01935v2') + entry('https://arxiv.org.evil.example/abs/2610.01935v2')}</feed>`);
});
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
config.allowPrivateNetworkFetch = true;
after(async () => { await new Promise<void>(resolve => server.close(() => resolve())); await stopBoss(); await closeDb(); });
const source = (path: string): SourceRow => ({ id: 'arxiv-test', name: 'arXiv', kind: 'rss', config: { feedUrl: base + path, fetchPublicContent: false }, tier: 'T1_5', first_party: true, participation_mode: 'editorial', interval_minutes: 1440, enabled: true, cursor: null, fail_count: 0 });

test('arXiv revisions keep one canonical paper while a third-party Atom keeps its own dates and author semantics', async () => {
  const { candidates } = await fetchRss(source('/versions'));
  assert.deepEqual(candidates.map(c => c.url), ['https://arxiv.org/abs/2610.01935', 'https://arxiv.org/abs/2610.01935', 'https://arxiv.org/abs/hep-th/9901001']);
  assert.equal(candidates[0]!.publishedAt!.toISOString(), '2026-10-01T10:00:00.000Z');
  assert.equal(candidates[1]!.sourceUpdatedAt!.toISOString(), '2026-10-02T12:00:00.000Z');
  assert.equal(candidates[2]!.publishedAt!.toISOString(), '2026-10-02T12:00:00.000Z');
  assert.equal(candidates[0]!.author, 'Alice');
  assert.deepEqual(candidates[1]!.raw, { id: 'https://arxiv.org/abs/2610.01935v2' });
  assert.ok(candidates.every(c => c.bodyText === null && c.bodyHtml === null));
});

test('only the official arXiv API contributes all authors and first-submission metadata, never a revision-date fallback', () => {
  const entry = { id: 'http://arxiv.org/abs/2610.01935v2', author: [{ name: 'Alice' }, { name: 'Bob' }], published: '2026-10-01T10:00:00Z', updated: '2026-10-02T12:00:00Z' };
  const metadata = arxivEntryMetadata('https://export.arxiv.org/api/query?search_query=cat:econ.EM', 'https://arxiv.org/abs/2610.01935v2', entry)!;
  assert.equal(metadata.author, 'Alice; Bob');
  assert.equal(metadata.publishedAt!.toISOString(), '2026-10-01T10:00:00.000Z');
  assert.deepEqual(metadata.raw, { id: entry.id, officialMetadata: { format: 'arxiv-api', versionUrl: 'https://arxiv.org/abs/2610.01935v2', published: entry.published, updated: entry.updated, authors: ['Alice', 'Bob'] } });
  assert.equal(arxivEntryMetadata('https://example.org/api/query', 'https://arxiv.org/abs/2610.01935v2', entry), null);
  assert.equal(arxivEntryMetadata('https://export.arxiv.org/other', 'https://arxiv.org/abs/2610.01935v2', entry), null);
  assert.equal(arxivEntryMetadata('https://export.arxiv.org/api/query', 'https://example.org/abs/2610.01935v2', entry), null);
  assert.equal(arxivEntryMetadata('https://export.arxiv.org/api/query', 'https://arxiv.org/abs/2610.01935v2', { ...entry, published: '' })!.publishedAt, null);
});

test('version-like URLs outside the exact arXiv paper path keep normal Atom behavior', async () => {
  const { candidates } = await fetchRss(source('/other'));
  assert.deepEqual(candidates.map(c => c.url), ['https://example.org/abs/2610.01935v2', 'https://arxiv.org/other/2610.01935v2', 'https://arxiv.org.evil.example/abs/2610.01935v2']);
  assert.ok(candidates.every(c => c.author === 'Alice' && c.publishedAt!.toISOString() === '2026-10-02T12:00:00.000Z'));
  assert.deepEqual(candidates[0]!.raw, { id: 'https://example.org/abs/2610.01935v2' });
});

test('new bibliographic versions refresh metadata without duplicating or revising unchanged paper text', async () => {
  const id = 'arxiv-metadata-' + tag();
  const config = { url: base + '/metadata', titlePaths: ['title'], urlTemplate: '{raw:url}', publishedAtPath: 'published', rawPaths: ['versionUrl', 'updated', 'authors'], fetchPublicContent: false };
  await sql`INSERT INTO sources (id,name,kind,config,next_fetch_at) VALUES (${id},'Paper bibliography','json_list',${sql.json(config)},'2100-01-01')`;
  assert.equal((await collectSource(id, { publicOnly: true })).created, 1);
  version = 2;
  const result = await collectSource(id, { publicOnly: true });
  assert.equal(result.created, 0);
  assert.equal(result.revised, 0);
  const rows = await sql`SELECT revision,raw,published_at FROM articles WHERE source_id=${id}`;
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.revision, 1);
  assert.equal(rows[0]!.published_at.toISOString(), '2026-10-01T10:00:00.000Z');
  assert.equal(rows[0]!.raw.officialMetadata.versionUrl, 'https://arxiv.org/abs/2610.01935v2');
  assert.equal(rows[0]!.raw.officialMetadata.updated, '2026-10-02T12:00:00Z');
  assert.deepEqual(rows[0]!.raw.officialMetadata.authors, ['Alice', 'Bob']);
});
