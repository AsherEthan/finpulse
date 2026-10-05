import assert from "node:assert/strict";
import { test } from "node:test";
import { DISCLOSURE_TOPICS } from "@aihot/industry/taxonomy";
import { disclosureTopicHref, disclosureTopicName } from "../app/lib/disclosure-filters.ts";
import { categoryHref } from "../app/lib/feed-filters.ts";
import { defaultTopicScope, topicEntryHref, topicPageHref, topicScopeFromParams } from "../app/lib/topic-scope.ts";

const target = (href: string) => new URL(href, "http://local");

test("disclosure subjects clear incompatible constraints and paging while retaining evidence and search filters", () => {
  const params = new URLSearchParams("category=policy&topic=policy-regulation&tag=正式文件&issuer=央行&issuer=证监会&region=中国&stage=正式文件&documentType=通知&view=selected&channel=firstParty&sourceType=original&nature=fact&verification=original_checked&q=财报&page=4&cursor=old");
  for (const topic of [null, ...DISCLOSURE_TOPICS.map(t => t.slug)]) {
    const next = target(disclosureTopicHref(params, topic));
    assert.equal(next.pathname, "/all");
    assert.equal(next.searchParams.get("category"), "first-hand");
    assert.equal(next.searchParams.get("topic"), topic);
    for (const key of ["tag", "page", "cursor", "issuer", "region", "stage", "documentType", "view"]) assert.equal(next.searchParams.has(key), false);
    for (const key of ["channel", "sourceType", "nature", "verification", "q"]) assert.equal(next.searchParams.get(key), params.get(key));
  }
  assert.equal(params.get("topic"), "policy-regulation");
  assert.deepEqual(params.getAll("issuer"), ["央行", "证监会"]);
});

test("leaving disclosures clears its subject and tag without changing independent filters", () => {
  const params = new URLSearchParams("category=first-hand&topic=disclosure-reports&tag=财报&channel=firstParty&sourceType=original&nature=fact&verification=original_checked&q=银行&page=2");
  for (const category of [null, "policy", "supply-chain", "capital-flow", "papers"]) {
    const next = target(categoryHref("/all", params, category));
    for (const key of ["tag", "topic", "page"]) assert.equal(next.searchParams.has(key), false);
    for (const key of ["channel", "sourceType", "nature", "verification", "q"]) assert.equal(next.searchParams.get(key), params.get(key));
  }
  const same = target(categoryHref("/all", params, "first-hand"));
  assert.equal(same.searchParams.get("topic"), "disclosure-reports");
  assert.equal(same.searchParams.get("tag"), "财报");
});

test("configured disclosure topics open all published disclosures while existing topic defaults remain", () => {
  for (const topic of DISCLOSURE_TOPICS) {
    assert.equal(disclosureTopicName(topic.slug), topic.name);
    assert.deepEqual(defaultTopicScope(topic.slug), { view: "all", category: "first-hand" });
    assert.deepEqual(topicScopeFromParams(topic.slug, new URLSearchParams()), { view: "all", category: "first-hand" });
    const href = target(topicEntryHref(topic.slug));
    assert.equal(href.searchParams.get("category"), "first-hand");
    assert.equal(href.searchParams.get("view"), "all");
  }
  assert.equal(disclosureTopicName("disclosure-not-configured"), null);
  assert.deepEqual(defaultTopicScope("disclosure-not-configured"), { view: "selected", category: null });
  assert.deepEqual(defaultTopicScope("papers"), { view: "all", category: "papers" });
  assert.deepEqual(defaultTopicScope("econ-development"), { view: "all", category: "papers" });
  assert.deepEqual(defaultTopicScope("policy-monetary"), { view: "all", category: "policy" });
  assert.deepEqual(defaultTopicScope("chain-auto-battery"), { view: "selected", category: null });
});

test("explicit selected disclosure views survive topic pagination and invalid values use disclosure defaults", () => {
  const scope = topicScopeFromParams("disclosure-reports", new URLSearchParams("view=selected"));
  assert.deepEqual(scope, { view: "selected", category: "first-hand" });
  const later = target(topicPageHref("disclosure-reports", scope, 3));
  assert.equal(later.pathname, "/topics/disclosure-reports/page/3");
  assert.equal(later.searchParams.get("view"), "selected");
  assert.equal(later.searchParams.get("category"), "first-hand");
  const first = target(topicPageHref("disclosure-reports", scope));
  assert.equal(first.pathname, "/topics/disclosure-reports");
  assert.deepEqual([...first.searchParams], [...later.searchParams]);
  assert.deepEqual(topicScopeFromParams("disclosure-macro", new URLSearchParams("view=constructor&category=__proto__")), { view: "all", category: "first-hand" });
});

test("related topics follow their own scope when leaving the disclosure column", () => {
  assert.equal(target(topicEntryHref("disclosure-labor")).searchParams.get("category"), "first-hand");
  assert.equal(target(topicEntryHref("econ-labor")).searchParams.get("category"), "papers");
  assert.equal(target(topicEntryHref("policy-monetary")).searchParams.get("category"), "policy");
  assert.equal(target(topicEntryHref("energy")).searchParams.has("category"), false);
});
