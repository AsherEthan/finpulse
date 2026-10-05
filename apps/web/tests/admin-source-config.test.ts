import assert from "node:assert/strict";
import { test } from "node:test";
import { parseSourceConfig, sourceAddressKey, sourceConfigDimension, updateSourceConfig, validateSourceAddress } from "../app/lib/admin-source-config.ts";

const complex = {
  url: "https://example.org/list",
  headers: { "Accept-Language": "zh-CN" },
  itemSelector: "article a",
  pagination: { pageParam: "p", maxPages: 3 },
  detail: { publishedAtAuthoritative: true, summarySelector: ".abstract" },
  fetchPublicContent: false,
  _aihot: { initialBackfillLimit: 20, initialBackfillMonths: 6, sourceDimension: "research" },
};

test("common source edits preserve complex collector settings and all other metadata", () => {
  const start = JSON.stringify(complex);
  const addressEdit = updateSourceConfig(start, { kind: "web_list", address: "https://example.org/new?page=1" });
  const edited = parseSourceConfig(updateSourceConfig(addressEdit, { dimension: "processed" }));
  assert.deepEqual(edited, { ...complex, url: "https://example.org/new?page=1", _aihot: { ...complex._aihot, sourceDimension: "processed" } });
  assert.equal(sourceConfigDimension(edited), "processed");
  assert.equal(complex.url, "https://example.org/list");
  assert.deepEqual(parseSourceConfig(updateSourceConfig(addressEdit, { dimension: null }))._aihot, { initialBackfillLimit: 20, initialBackfillMonths: 6 });
});

test("RSS edits preserve the existing address key and unrelated fields", () => {
  for (const key of ["feedUrl", "url"]) {
    const config = { [key]: "https://example.org/feed", summaryIsBody: true, _aihot: { initialBackfillLimit: 8 } };
    assert.equal(sourceAddressKey("rss", config), key);
    assert.deepEqual(parseSourceConfig(updateSourceConfig(JSON.stringify(config), { kind: "rss", address: "https://example.org/next" })), { ...config, [key]: "https://example.org/next" });
  }
  assert.equal(sourceAddressKey("rss", { feedUrl: "https://example.org/a", url: "https://example.org/b" }), "feedUrl");
  assert.equal(sourceAddressKey("rss", {}), "feedUrl");
  for (const kind of ["external", "x_search", "mp_account"]) assert.equal(sourceAddressKey(kind, {}), null);
});

test("partial addresses remain editable without dropping collector settings, but cannot be saved", () => {
  const partial = parseSourceConfig(updateSourceConfig(JSON.stringify(complex), { kind: "json_list", address: "https://" }));
  assert.deepEqual(partial.pagination, complex.pagination);
  assert.deepEqual(partial._aihot, complex._aihot);
  assert.throws(() => validateSourceAddress("json_list", partial), /有效/);
  for (const url of ["", "relative/path", "javascript:alert(1)", "file:///tmp/feed", 123]) assert.throws(() => validateSourceAddress("rss", { feedUrl: url }), /有效/);
  assert.doesNotThrow(() => validateSourceAddress("json_list", complex));
  assert.doesNotThrow(() => validateSourceAddress("external", {}));
});

test("invalid advanced JSON cannot be replaced by a common field edit", () => {
  for (const text of ["{", "[]", "null", "123"]) {
    assert.throws(() => parseSourceConfig(text), /配置/);
    assert.throws(() => updateSourceConfig(text, { dimension: "original" }), /配置/);
    assert.throws(() => updateSourceConfig(text, { kind: "rss", address: "https://example.org/feed" }), /配置/);
  }
  assert.throws(() => updateSourceConfig('{"_aihot":"invalid","url":"https://example.org"}', { dimension: "signal" }), /_aihot/);
  assert.equal(sourceConfigDimension({ _aihot: { sourceDimension: "constructor" } }), null);
});
