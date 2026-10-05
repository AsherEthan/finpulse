import './setup.ts';
import assert from 'node:assert/strict';
import http from 'node:http';
import { after, test } from 'node:test';
import { config } from '@aihot/backend/config';
import { fetchRss } from '@aihot/backend/sources/rss';
import type { SourceRow } from '@aihot/backend/sources/types';

const server = http.createServer((req, res) => {
  if (req.url === '/redirect') { res.writeHead(302, { location: '/actual/feed.xml' }); res.end(); return; }
  res.setHeader('content-type', 'application/rss+xml');
  res.end(req.url === '/bases.xml'
    ? `<rss version="2.0" xml:base="https://example.org/root/"><channel xml:base="../releases/"><item xml:base="2026/"><title>Release</title><link>cpi.html#table</link></item><item><title>Absolute</title><link>https://other.example.org/release</link></item></channel></rss>`
    : `<rss version="2.0"><channel><item><title>Wages</title><link><![CDATA[/sc/press_release_detail.html?id=5810&r=rss]]></link><description>Official short description</description></item><item><title>Prices</title><link>prices.html</link></item><item><title>Missing link</title></item><item><title>Malformed link</title><link>http://[</link></item></channel></rss>`);
});
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
config.allowPrivateNetworkFetch = true;
after(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });
const source = (path: string): SourceRow => ({ id: 'relative-rss', name: 'Relative RSS', kind: 'rss', config: { feedUrl: base + path, fetchPublicContent: false, preserveUrlFragment: true }, tier: 'T1', first_party: true, participation_mode: 'editorial', interval_minutes: 1440, enabled: true, cursor: null, fail_count: 0 });

test('RSS root and path-relative article links resolve against the final redirected feed URL', async () => {
  const { candidates } = await fetchRss(source('/redirect'));
  assert.deepEqual(candidates.map(c => c.url), [base + '/sc/press_release_detail.html?id=5810&r=rss', base + '/actual/prices.html']);
  assert.equal(candidates[0]!.excerpt, 'Official short description');
  assert.equal(candidates[0]!.bodyText, null);
});

test('RSS XML Base composes across root, channel and item without changing absolute links or fragment identity', async () => {
  const { candidates } = await fetchRss(source('/bases.xml'));
  assert.deepEqual(candidates.map(c => c.url), ['https://example.org/releases/2026/cpi.html#table', 'https://other.example.org/release']);
  assert.equal(candidates[0]!.identityKey, 'url:https://example.org/releases/2026/cpi.html#table');
});
