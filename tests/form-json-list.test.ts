import "./setup.ts";
import assert from "node:assert/strict";
import http from "node:http";
import { after, test } from "node:test";
import { config } from "@aihot/backend/config";
import { fetchJsonList } from "@aihot/backend/sources/json-list";
import { readListingWindow } from "@aihot/backend/sources/pagination";
import { unsupportedConfig } from "@aihot/backend/sources/config-keys";
import type { SourceRow } from "@aihot/backend/sources/types";

const requests: Array<{ method: string; type: string; fields: Record<string, string> }> = [];
const server = http.createServer(async (req, res) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  const fields = Object.fromEntries(new URLSearchParams(body));
  requests.push({ method: req.method!, type: String(req.headers["content-type"]), fields });
  const page = Number(fields.pageNum ?? 1);
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ announcements: page <= 2 ? [
    { id: page, title: `月度产销 ${page}`, date: "2026-09-30", path: page === 1 ? "../reports/current.html" : "https://example.org/reports/prior.html" },
  ] : [] }));
});
await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
const port = (server.address() as { port: number }).port;
config.allowPrivateNetworkFetch = true;
after(() => new Promise<void>(resolve => server.close(() => resolve())));

const source = (patch: Record<string, unknown> = {}): SourceRow => ({
  id: "form-local", name: "Local original disclosure", kind: "json_list", tier: "T1", first_party: true,
  participation_mode: "editorial", interval_minutes: 240, enabled: true, cursor: null, fail_count: 0,
  config: { url: `http://127.0.0.1:${port}/query`, method: "POST", mode: "json_api", itemsPath: "announcements",
    titlePaths: ["title"], urlTemplate: "https://example.org/disclosures/{id}", publishedAtPath: "date",
    bodyForm: { stock: "002594,gshk0001211", searchkey: "产销 & 更正", zero: 0, checked: false }, ...patch },
});

test("official form requests preserve scalars, encoding and form pagination without mixing JSON", async () => {
  const cfg = source({ headers: { "Content-Type": "application/json" }, pagination: { bodyPageField: "pageNum", maxPages: 3, pageSize: 1 } });
  assert.deepEqual(unsupportedConfig("json_list", cfg.config), []);
  assert.deepEqual(unsupportedConfig("json_list", { adapter: "mimo_home" }), ["adapter=mimo_home"]);
  assert.deepEqual(unsupportedConfig("web_list", { adapter: "gfex_warehouse" }), ["adapter=gfex_warehouse"]);
  const result = await readListingWindow(cfg, fetchJsonList);
  assert.deepEqual(result.candidates.map(c => c.title), ["月度产销 1", "月度产销 2"]);
  assert.equal(result.pages, 3);
  assert.equal(result.truncated, false);
  assert.deepEqual(requests.map(r => r.fields.pageNum), ["1", "2", "3"]);
  for (const r of requests) {
    assert.equal(r.method, "POST");
    assert.equal(r.type, "application/x-www-form-urlencoded");
    assert.equal(r.fields.stock, "002594,gshk0001211");
    assert.equal(r.fields.searchkey, "产销 & 更正");
    assert.equal(r.fields.zero, "0");
    assert.equal(r.fields.checked, "false");
  }
});

test("invalid or mixed form configuration fails before sending a request", async () => {
  const before = requests.length;
  for (const patch of [{ bodyJson: {} }, { method: "GET" }, { bodyForm: { nested: {} } }, { bodyForm: [] }, { bodyForm: { invalid: Infinity } }]) {
    await assert.rejects(fetchJsonList(source(patch)), /bodyForm/);
  }
  assert.equal(requests.length, before);
});

test("JSON original links resolve relative paths while retaining absolute links", async () => {
  const cfg = source({ baseUrl: "https://example.org/news/", urlTemplate: "{raw:path}", pagination: { bodyPageField: "pageNum", maxPages: 3, pageSize: 1 } });
  assert.deepEqual(unsupportedConfig("json_list", cfg.config), []);
  const result = await readListingWindow(cfg, fetchJsonList);
  assert.deepEqual(result.candidates.map(c => c.url), ["https://example.org/reports/current.html", "https://example.org/reports/prior.html"]);
});

test("static zero-based archives retain the current first page and reject cross-origin first pages", async () => {
  const cfg = source({ url: "https://example.org/list/", pagination: { firstPageUrl: "https://example.org/list/", urlTemplate: "https://example.org/list/index_{page}.html", startPage: 0, maxPages: 3 } });
  const urls: string[] = [];
  const result = await readListingWindow(cfg, async s => {
    urls.push(s.config.url);
    return urls.length < 3 ? [{ title: "Original report", url: `https://example.org/report/${urls.length}` }] : [];
  });
  assert.deepEqual(urls, ["https://example.org/list/", "https://example.org/list/index_1.html", "https://example.org/list/index_2.html"]);
  assert.equal(result.candidates.length, 2);
  await assert.rejects(readListingWindow(source({ pagination: { firstPageUrl: "https://other.example/list", pageParam: "page" } }), async () => []), /listing origin/);
});
