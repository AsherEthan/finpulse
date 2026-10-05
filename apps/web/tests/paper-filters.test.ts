import assert from "node:assert/strict";
import { test } from "node:test";
import { ECONOMICS_TOPICS } from "@aihot/industry/taxonomy";
import { economicsTopicName, paperTopicHref } from "../app/lib/paper-filters.ts";
import { defaultTopicScope, topicEntryHref, topicPageHref, topicScopeFromParams } from "../app/lib/topic-scope.ts";

const target = (href: string) => new URL(href, "http://local");

test("switching paper subjects clears intersecting tags and paging while retaining evidence and search filters", () => {
  const params = new URLSearchParams("category=papers&topic=econ-labor&tag=就业与劳动&channel=firstParty&sourceType=research&nature=estimate&verification=original_checked&q=中国&page=4&cursor=old");
  for (const topic of [null, ...ECONOMICS_TOPICS.map(t => t.slug)]) {
    const next = target(paperTopicHref(params, topic));
    assert.equal(next.pathname, "/all");
    assert.equal(next.searchParams.get("category"), "papers");
    assert.equal(next.searchParams.get("topic"), topic);
    for (const key of ["tag", "page", "cursor"]) assert.equal(next.searchParams.has(key), false);
    for (const key of ["channel", "sourceType", "nature", "verification", "q"]) assert.equal(next.searchParams.get(key), params.get(key));
  }
  assert.equal(params.get("topic"), "econ-labor");
  assert.equal(params.get("tag"), "就业与劳动");
});

test("paper subjects entered from policy cannot inherit policy-only conditions or a selected-only view", () => {
  const next = target(paperTopicHref(new URLSearchParams("category=policy&issuer=央行&region=中国&stage=正式文件&documentType=通知&view=selected&tag=正式文件&q=利率"), "econ-macro"));
  assert.equal(next.searchParams.get("category"), "papers");
  assert.equal(next.searchParams.get("topic"), "econ-macro");
  assert.equal(next.searchParams.get("q"), "利率");
  for (const key of ["issuer", "region", "stage", "documentType", "view", "tag"]) assert.equal(next.searchParams.has(key), false);
});

test("paper and economics topics default to all papers, policy retains its scope, and other topics retain selected", () => {
  for (const slug of ["papers", ...ECONOMICS_TOPICS.map(t => t.slug)]) {
    assert.deepEqual(defaultTopicScope(slug), { view: "all", category: "papers" });
    assert.deepEqual(topicScopeFromParams(slug, new URLSearchParams()), { view: "all", category: "papers" });
    const href = target(topicEntryHref(slug));
    assert.equal(href.searchParams.get("view"), "all");
    assert.equal(href.searchParams.get("category"), "papers");
  }
  assert.deepEqual(defaultTopicScope("policy-monetary"), { view: "all", category: "policy" });
  assert.deepEqual(defaultTopicScope("chain-auto-battery"), { view: "selected", category: null });
  assert.equal(topicEntryHref("chain-auto-battery"), "/topics/chain-auto-battery");
});

test("explicit selected paper views survive pagination and page-one navigation", () => {
  const scope = topicScopeFromParams("econ-trade", new URLSearchParams("view=selected"));
  assert.deepEqual(scope, { view: "selected", category: "papers" });
  const later = target(topicPageHref("econ-trade", scope, 3));
  assert.equal(later.pathname, "/topics/econ-trade/page/3");
  assert.equal(later.searchParams.get("view"), "selected");
  assert.equal(later.searchParams.get("category"), "papers");
  const first = target(topicPageHref("econ-trade", scope));
  assert.equal(first.pathname, "/topics/econ-trade");
  assert.deepEqual([...first.searchParams], [...later.searchParams]);
});

test("related topic entry follows its own category instead of inheriting the current paper restriction", () => {
  const policy = target(topicEntryHref("policy-monetary"));
  assert.equal(policy.searchParams.get("category"), "policy");
  const sector = target(topicEntryHref("chain-auto-battery"));
  assert.equal(sector.searchParams.has("category"), false);
  const paper = target(topicEntryHref("econ-growth"));
  assert.equal(paper.searchParams.get("category"), "papers");
  assert.equal(paper.searchParams.get("view"), "all");
});

test("economics titles use configured subjects and invalid query values fall back to topic defaults", () => {
  for (const topic of ECONOMICS_TOPICS) assert.equal(economicsTopicName(topic.slug), topic.name);
  assert.equal(economicsTopicName("policy-monetary"), null);
  assert.deepEqual(topicScopeFromParams("papers", new URLSearchParams("view=constructor&category=__proto__")), { view: "all", category: "papers" });
  assert.deepEqual(topicScopeFromParams("market-confidence", new URLSearchParams("view=all&category=first-hand")), { view: "all", category: "first-hand" });
});
