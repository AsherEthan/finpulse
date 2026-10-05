import "./setup.ts";
import assert from "node:assert/strict";
import http from "node:http";
import { after, test } from "node:test";
import { config } from "@aihot/backend/config";
import { fetchJsonList } from "@aihot/backend/sources/json-list";
import type { SourceRow } from "@aihot/backend/sources/types";

const dates: unknown[] = [[2026, 9, 28], [2026, 9], [2026], [2026, 2, 30], [2028, 2, 29], [2026, 2, 29], [2026, 13, 1], [2026, 9, 2.5], [2026, 9, 28, 12], "2026,9,28"];
const server = http.createServer((_req, res) => {
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ message: { items: dates.map((date, index) => ({
    DOI: `10.1234/paper.${index}`, title: [`Study ${index}`], published: { "date-parts": [date] },
    author: [{ given: "Alice", family: "A" }, { given: "Bob", family: "B" }],
    created: { "date-time": "2026-10-04T00:00:00Z" }, abstract: "Publisher-owned abstract is not requested for storage",
  })) } }));
});
await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
config.allowPrivateNetworkFetch = true;
after(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });
const source = {
  id: "scholarly-metadata", kind: "json_list", participation_mode: "editorial",
  config: { url: `http://127.0.0.1:${(server.address() as { port: number }).port}`, itemsPath: "message.items",
    titlePaths: ["title.0"], urlTemplate: "https://doi.org/{DOI}", externalIdPath: "DOI",
    publishedAtPath: "published.date-parts.0", publishedAtUnit: "date_parts", fetchPublicContent: false,
    rawPaths: ["DOI", "author", "published"],
  },
} as unknown as SourceRow;

test("scholarly dates preserve full calendar days while partial, impossible and malformed dates stay unknown", async () => {
  const items = await fetchJsonList(source);
  assert.deepEqual(items.map(item => item.publishedAt?.toISOString() ?? null), [
    "2026-09-28T00:00:00.000Z", null, null, null, "2028-02-29T00:00:00.000Z", null, null, null, null, null,
  ]);
  assert.equal(items[1]!.publishedAt, null, "a record's deposit timestamp must not stand in for its publication month");
});

test("publisher-deposited bibliography keeps DOI identity and all authors without copying its abstract or inventing an author", async () => {
  const items = await fetchJsonList(source);
  assert.equal(items[0]!.url, "https://doi.org/10.1234/paper.0");
  assert.equal(items[0]!.author, null);
  assert.equal(items[0]!.excerpt, null);
  assert.equal(items[0]!.bodyText, null);
  const raw = items[0]!.raw as { officialMetadata: { author: unknown[]; published: unknown; abstract?: unknown } };
  assert.equal(raw.officialMetadata.author.length, 2);
  assert.deepEqual(raw.officialMetadata.published, { "date-parts": [[2026, 9, 28]] });
  assert.equal(raw.officialMetadata.abstract, undefined);
});
