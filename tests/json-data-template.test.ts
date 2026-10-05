import "./setup.ts";
import assert from "node:assert/strict";
import http from "node:http";
import { after, test } from "node:test";
import { config } from "@aihot/backend/config";
import { fetchJsonList } from "@aihot/backend/sources/json-list";
import { unsupportedConfig } from "@aihot/backend/sources/config-keys";
import type { SourceRow } from "@aihot/backend/sources/types";

const server = http.createServer((_req, res) => {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify([{ lastupdated: "2026-07-13" }, [
    { indicator: { value: "私人部门信贷/GDP" }, date: "2024", value: 194.3125, title: "fallback" },
    { indicator: { value: "私人部门信贷/GDP" }, date: "2023", value: 0 },
    { indicator: { value: "私人部门信贷/GDP" }, date: "2022", value: null, title: "fallback" },
    { indicator: { value: "私人部门信贷/GDP" }, date: "2021" },
  ]]));
});
await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
const port = (server.address() as { port: number }).port;
config.allowPrivateNetworkFetch = true;
after(() => new Promise<void>(resolve => server.close(() => resolve())));

const source: SourceRow = {
  id: "data-template-local", name: "Local data", kind: "json_list", tier: "T1", first_party: false,
  participation_mode: "editorial", interval_minutes: 1440, enabled: true, cursor: null, fail_count: 0,
  config: {
    url: `http://127.0.0.1:${port}/data`, itemsPath: "1", titlePaths: ["title"],
    titleTemplate: "{raw:indicator.value}｜{raw:date}年：{raw:value}%",
    summaryTemplate: "指标：{raw:indicator.value}；年度：{raw:date}；数值：{raw:value}%；期末存量指标。",
    summaryIsBody: true, urlTemplate: "https://example.org/data?date={date}", rawPaths: ["date", "value", "indicator.value"],
  },
};

test("JSON dataset templates retain indicator, period, value and unit without inventing a release date", async () => {
  assert.deepEqual(unsupportedConfig("json_list", source.config), []);
  const rows = await fetchJsonList(source);
  assert.deepEqual(rows.map(r => r.title), ["私人部门信贷/GDP｜2024年：194.3125%", "私人部门信贷/GDP｜2023年：0%"]);
  assert.deepEqual(rows.map(r => r.url), ["https://example.org/data?date=2024", "https://example.org/data?date=2023"]);
  assert.ok(rows.every(r => r.publishedAt === null && r.bodyStatus === "ok"));
  assert.match(rows[0]!.bodyText!, /年度：2024；数值：194.3125%/);
  assert.equal((rows[0]!.raw as { officialMetadata: Record<string, unknown> }).officialMetadata.value, 194.3125);
});

test("an explicit missing data template cannot fall back to a generic title or guessed summary", async () => {
  const rows = await fetchJsonList({ ...source, config: { ...source.config, summaryTemplate: "{raw:missing}", summaryPaths: ["value"] } });
  assert.equal(rows.length, 2);
  assert.ok(rows.every(r => r.excerpt === null && r.bodyText === null && r.bodyStatus === "pending"));
});
