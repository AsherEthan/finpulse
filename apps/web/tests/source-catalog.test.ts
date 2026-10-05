import assert from "node:assert/strict";
import { test } from "node:test";
import type { SourceCatalogEntry } from "@aihot/contracts/sources";
import { resolveRedirect } from "@aihot/contracts/http-policy";
import { filterSourceCatalog, sourceCatalogFilters, sourceCatalogHref } from "../app/lib/source-catalog.ts";

const sample: SourceCatalogEntry[] = [
  { id: "bis", name: "BIS 中国研究", url: "https://www.bis.org/about/asia/publications", tags: ["论文", "中国"], sourceDimension: "research", firstParty: true, tier: "T1_5", enabled: true, intervalMinutes: 1440, state: "ok", lastSuccessAt: null, lastAttemptAt: null, publishedCount: 1 },
  { id: "news", name: "媒体财经", url: "https://news.example.com/finance", tags: ["中国", "政策/监管"], sourceDimension: "secondary", firstParty: false, tier: "T2", enabled: true, intervalMinutes: 180, state: "failed", lastSuccessAt: null, lastAttemptAt: null, publishedCount: 0 },
  { id: "data", name: "世界银行年度数据", url: "https://api.worldbank.org/CHN", tags: ["中国", "数据"], sourceDimension: "processed", firstParty: false, tier: "T1_5", enabled: false, intervalMinutes: 1440, state: "paused", lastSuccessAt: null, lastAttemptAt: null, publishedCount: 1 },
];

test("public source directory stays public while legacy detail bookmarks retain their admin destination", () => {
  assert.equal(resolveRedirect("/sources", "?q=中国"), null);
  assert.equal(resolveRedirect("/sources/", "?q=中国")?.location, "/sources?q=中国");
  assert.equal(resolveRedirect("/sources/bis", "")?.location, "/admin/sources/bis");
});

test("catalog combines independent source, tag, state and search filters without dropping paused sources", () => {
  assert.equal(filterSourceCatalog(sample, sourceCatalogFilters(new URLSearchParams())).length, 3);
  const filters = sourceCatalogFilters(new URLSearchParams("q=BIS%20中国&sourceType=research&tag=论文&enabled=true&state=ok"));
  assert.deepEqual(filterSourceCatalog(sample, filters).map(s => s.id), ["bis"]);
  assert.deepEqual(filterSourceCatalog(sample, sourceCatalogFilters(new URLSearchParams("q=API.WORLDBANK&enabled=false"))).map(s => s.id), ["data"]);
  assert.deepEqual(filterSourceCatalog(sample, sourceCatalogFilters(new URLSearchParams("sourceType=research&state=failed"))), []);
});

test("catalog rejects invalid enum and page values and tag navigation preserves other filters", () => {
  for (const bad of ["constructor", "__proto__", "unknown"]) {
    const filters = sourceCatalogFilters(new URLSearchParams(`sourceType=${bad}&state=${bad}&enabled=${bad}&page=-1`));
    assert.equal(filters.sourceType, null);
    assert.equal(filters.state, null);
    assert.equal(filters.enabled, null);
    assert.equal(filters.page, 1);
  }
  const initial = new URLSearchParams("q=中国&sourceType=research&enabled=true&state=ok&page=4");
  const tagged = new URL(sourceCatalogHref(initial, { tag: "论文" }), "https://site.example");
  assert.equal(tagged.searchParams.has("page"), false);
  for (const key of ["q", "sourceType", "enabled", "state"]) assert.equal(tagged.searchParams.get(key), initial.get(key));
  const page = new URL(sourceCatalogHref(tagged.searchParams, { page: 2 }), "https://site.example");
  assert.equal(page.searchParams.get("page"), "2");
  assert.equal(page.searchParams.get("tag"), "论文");
});
