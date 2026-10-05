import assert from "node:assert/strict";
import { test } from "node:test";
import { appendPolicyFilters, policyFiltersFromParams, policyTagHref, publicEvidenceUrl, togglePolicyFilter } from "../app/lib/policy-filters.ts";

test("policy dimensions accept independent repeated values and trim duplicate entries", () => {
  const params = new URLSearchParams("issuer=央行&issuer=证监会&issuer=央行&region=中国&stage=正式文件&documentType=通知");
  assert.deepEqual(policyFiltersFromParams(params), { issuers: ["央行", "证监会"], regions: ["中国"], stages: ["正式文件"], documentTypes: ["通知"] });
});

test("toggling one policy option preserves other dimensions, first-party, topic and search", () => {
  const params = new URLSearchParams("category=policy&channel=firstParty&issuer=央行&issuer=证监会&region=中国&topic=policy-monetary&q=利率&page=3");
  const toggled = new URL(togglePolicyFilter(params, "issuer", "央行"), "http://local");
  assert.deepEqual(toggled.searchParams.getAll("issuer"), ["证监会"]);
  for (const key of ["category", "channel", "region", "topic", "q"]) assert.equal(toggled.searchParams.get(key), params.get(key));
  assert.equal(toggled.searchParams.has("page"), false);
});

test("policy tag navigation stays inside the policy scope and retains combined filters", () => {
  const params = new URLSearchParams("issuer=央行&stage=正式文件&q=专项债&page=2");
  const target = new URL(policyTagHref("政策执行", "policy", params), "http://local");
  assert.equal(target.searchParams.get("category"), "policy");
  assert.equal(target.searchParams.get("tag"), "政策执行");
  assert.equal(target.searchParams.get("issuer"), "央行");
  assert.equal(target.searchParams.get("page"), null);
  assert.equal(new URL(policyTagHref("流动性", "capital-flow", params), "http://local").searchParams.get("category"), null);
});

test("policy query serialization retains repeated dimensions", () => {
  assert.deepEqual(appendPolicyFilters(new URLSearchParams("q=信用"), { issuers: ["央行", "金融监管总局"], stages: ["征求意见"] }).getAll("issuer"), ["央行", "金融监管总局"]);
});

test("supply-chain tags retain their column, theme and first-party source filter", () => {
  const params = new URLSearchParams("category=supply-chain&channel=firstParty&topic=chain-auto-battery&page=2");
  const next = new URL(policyTagHref("交付", "supply-chain", params), "http://local");
  assert.equal(next.searchParams.get("category"), "supply-chain");
  assert.equal(next.searchParams.get("topic"), "chain-auto-battery");
  assert.equal(next.searchParams.get("channel"), "firstParty");
  assert.equal(next.searchParams.get("tag"), "交付");
  assert.equal(next.searchParams.has("page"), false);
  const general = new URL(policyTagHref("流动性", "capital-flow", params), "http://local");
  assert.equal(general.searchParams.get("channel"), "firstParty");
  assert.equal(general.searchParams.has("topic"), false);
});

test("disclosure tag navigation retains the column, subject and independent evidence filters", () => {
  const params = new URLSearchParams("category=first-hand&topic=disclosure-macro&tag=月度&channel=firstParty&sourceType=original&nature=estimate&verification=original_checked&q=物价&page=3&cursor=old");
  const next = new URL(policyTagHref("宏观统计", "first-hand", params), "http://local");
  assert.equal(next.pathname, "/all");
  assert.equal(next.searchParams.get("category"), "first-hand");
  assert.equal(next.searchParams.get("tag"), "宏观统计");
  for (const key of ["topic", "channel", "sourceType", "nature", "verification", "q"]) assert.equal(next.searchParams.get(key), params.get(key));
  for (const key of ["page", "cursor"]) assert.equal(next.searchParams.has(key), false);
  assert.equal(params.get("tag"), "月度");
  assert.equal(params.get("page"), "3");
  assert.equal(new URL(policyTagHref("财报", "first-hand"), "http://local").searchParams.get("category"), "first-hand");
});

test("policy evidence URLs reject script URLs, credentials and relative paths", () => {
  for (const value of ["javascript:alert(1)", "data:text/html,hello", "/local", "https://user:secret@example.com/doc"]) assert.equal(publicEvidenceUrl(value), null);
  assert.equal(publicEvidenceUrl("https://www.pbc.gov.cn/file.pdf"), "https://www.pbc.gov.cn/file.pdf");
});
