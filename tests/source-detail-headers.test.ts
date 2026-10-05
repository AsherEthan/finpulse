import "./setup.ts";
import assert from "node:assert/strict";
import http from "node:http";
import { after, test } from "node:test";
import { config } from "@aihot/backend/config";
import { fetchDetail } from "@aihot/backend/sources/web-list";
import type { SourceRow } from "@aihot/backend/sources/types";
const requests: http.IncomingHttpHeaders[] = [];
async function fixture() {
  const server = http.createServer((req, res) => {
    requests.push(req.headers);
    res.writeHead(200, { "content-type": "text/html" });
    res.end('<html><head><meta name="pubdate" content="2026-07-08 17:01"></head><body><div id="con_time">发布时间：2026-06-30 18:45</div></body></html>');
  });
  await new Promise<void>(r => server.listen(0, "127.0.0.1", r));
  return { server, url: `http://127.0.0.1:${(server.address() as { port: number }).port}` };
}
const a = await fixture(), b = await fixture();
config.allowPrivateNetworkFetch = true;
after(async () => { for (const f of [a, b]) await new Promise<void>(r => f.server.close(() => r())); });
const source: SourceRow = { id: "detail-local", name: "Official local fixture", kind: "web_list", tier: "T1", first_party: true,
  participation_mode: "editorial", interval_minutes: 240, enabled: true, cursor: null, fail_count: 0,
  config: { url: `${a.url}/listing`, headers: { "user-agent": "FinPulseBot-test", authorization: "Bearer local-test" },
    detail: { publishedAtSelector: "#con_time", publishedAtUtcOffset: "+08:00" } } };
const need = { date: true, title: false, summary: false, body: false };
test("same-origin details retain source headers and use the visible publication date over metadata", async () => {
  const result = await fetchDetail(`${a.url}/article`, source, need);
  assert.equal(result.publishedAt?.toISOString(), "2026-06-30T10:45:00.000Z");
  assert.equal(requests.at(-1)?.["user-agent"], "FinPulseBot-test");
  assert.equal(requests.at(-1)?.authorization, "Bearer local-test");
});
test("cross-origin details never receive listing authorization or custom headers", async () => {
  await fetchDetail(`${b.url}/article`, source, need);
  assert.equal(requests.at(-1)?.authorization, undefined);
  assert.notEqual(requests.at(-1)?.["user-agent"], "FinPulseBot-test");
});
