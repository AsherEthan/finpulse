import assert from "node:assert/strict";
import { test } from "node:test";
import { categoryHref, firstPartyHref, hrefWith } from "../app/lib/feed-filters.ts";
import { informationFiltersFromParams } from "../app/lib/information-labels.ts";

const target = (href: string) => new URL(href, "http://local");

test("both selected and full feeds retain first-party identity across main columns and all", () => {
  for (const base of ["/", "/all"]) {
    for (const category of ["first-hand", "supply-chain", "policy", "capital-flow", "papers", null]) {
      const params = new URLSearchParams("category=capital-flow&channel=firstParty&q=流动性&page=3&cursor=old");
      const next = target(categoryHref(base, params, category));
      assert.equal(next.pathname, base);
      assert.equal(next.searchParams.get("category"), category);
      assert.equal(next.searchParams.get("channel"), "firstParty");
      assert.equal(next.searchParams.get("q"), "流动性");
      assert.equal(next.searchParams.has("page"), false);
      assert.equal(next.searchParams.has("cursor"), false);
      assert.equal(params.get("page"), "3");
    }
  }
});

test("source identity toggles without losing the main column, search or policy dimensions", () => {
  for (const base of ["/", "/all"]) {
    const params = new URLSearchParams("category=policy&topic=policy-monetary&tag=正式文件&issuer=央行&issuer=证监会&region=中国&q=利率&page=4");
    const on = target(firstPartyHref(base, params));
    assert.equal(on.searchParams.get("channel"), "firstParty");
    for (const key of ["category", "topic", "tag", "issuer", "region", "q"]) assert.deepEqual(on.searchParams.getAll(key), params.getAll(key));
    const off = target(firstPartyHref(base, on.searchParams));
    assert.equal(off.searchParams.has("channel"), false);
    assert.equal(off.searchParams.get("category"), "policy");
    assert.equal(off.searchParams.has("page"), false);
  }
});

test("switching between policy and supply chain clears their scoped conditions, retaining source and search", () => {
  for (const base of ["/", "/all"]) {
    const policy = new URLSearchParams("category=policy&channel=firstParty&topic=policy-fiscal&tag=正式文件&issuer=财政部&region=中国&stage=正式文件&documentType=通知&q=设备");
    const chain = target(categoryHref(base, policy, "supply-chain"));
    for (const key of ["topic", "tag", "issuer", "region", "stage", "documentType"]) assert.equal(chain.searchParams.has(key), false);
    assert.equal(chain.searchParams.get("channel"), "firstParty");
    assert.equal(chain.searchParams.get("q"), "设备");
    const back = target(categoryHref(base, new URLSearchParams("category=supply-chain&channel=firstParty&topic=chain-auto-battery&tag=验收"), "policy"));
    assert.equal(back.searchParams.has("topic"), false);
    assert.equal(back.searchParams.has("tag"), false);
    assert.equal(back.searchParams.get("channel"), "firstParty");
    const same = target(categoryHref(base, policy, "policy"));
    assert.equal(same.searchParams.get("topic"), "policy-fiscal");
    assert.equal(same.searchParams.get("issuer"), "财政部");
  }
});

test("mobile search keeps the chosen main column and first-party source identity", () => {
  const next = target(hrefWith("/all", new URLSearchParams("category=supply-chain&channel=firstParty&tag=库存&page=2"), { search: "1" }));
  assert.equal(next.searchParams.get("category"), "supply-chain");
  assert.equal(next.searchParams.get("channel"), "firstParty");
  assert.equal(next.searchParams.get("tag"), "库存");
  assert.equal(next.searchParams.get("search"), "1");
  assert.equal(next.searchParams.has("page"), false);
});

test("leaving capital flows clears its topic and stock or flow tag without losing source identity", () => {
  const params = new URLSearchParams("category=capital-flow&channel=firstParty&topic=fund-public&tag=存量&q=基金&page=2");
  for (const category of ["first-hand", "supply-chain", "policy", "papers", null]) {
    const next = target(categoryHref("/all", params, category));
    assert.equal(next.searchParams.has("topic"), false);
    assert.equal(next.searchParams.has("tag"), false);
    assert.equal(next.searchParams.get("channel"), "firstParty");
    assert.equal(next.searchParams.get("q"), "基金");
  }
  const same = target(categoryHref("/all", params, "capital-flow"));
  assert.equal(same.searchParams.get("topic"), "fund-public");
  assert.equal(same.searchParams.get("tag"), "存量");
});

test("leaving papers clears its topic and paper tag while retaining independent source and verification", () => {
  const params = new URLSearchParams("category=papers&topic=papers&tag=论文&sourceType=research&nature=estimate&verification=original_checked&channel=firstParty&q=中国&page=2");
  for (const category of ["first-hand", "supply-chain", "policy", "capital-flow", null]) {
    const next = target(categoryHref("/all", params, category));
    for (const key of ["topic", "tag", "page"]) assert.equal(next.searchParams.has(key), false);
    for (const key of ["sourceType", "nature", "verification", "channel", "q"]) assert.equal(next.searchParams.get(key), params.get(key));
  }
  const same = target(categoryHref("/all", params, "papers"));
  assert.equal(same.searchParams.get("tag"), "论文");
  assert.equal(same.searchParams.get("topic"), "papers");
});

test("source, nature and verification remain independent across columns, first-party toggle and search", () => {
  const params = new URLSearchParams("category=capital-flow&topic=fund-public&tag=存量&sourceType=research&nature=estimate&verification=original_checked&q=规模&page=3");
  for (const href of [categoryHref("/all", params, "supply-chain"), firstPartyHref("/all", params), hrefWith("/all", params, { search: "1" })]) {
    const next = target(href);
    for (const key of ["sourceType", "nature", "verification", "q"]) assert.equal(next.searchParams.get(key), params.get(key));
    assert.equal(next.searchParams.has("page"), false);
  }
  const cleared = target(hrefWith("/all", params, { sourceType: null, nature: null, verification: null }));
  for (const key of ["sourceType", "nature", "verification"]) assert.equal(cleared.searchParams.has(key), false);
  for (const key of ["category", "topic", "tag", "q"]) assert.equal(cleared.searchParams.get(key), params.get(key));
});

test("information filters only accept the public enum and do not infer verified fact from source type", () => {
  assert.deepEqual(informationFiltersFromParams(new URLSearchParams("sourceType=research&nature=estimate&verification=original_checked")), { sourceType: "research", nature: "estimate", verification: "original_checked" });
  assert.deepEqual(informationFiltersFromParams(new URLSearchParams("sourceType=original")), { sourceType: "original", nature: null, verification: null });
  for (const invalid of ["true", "constructor", "toString", "__proto__", "fact%20"]) {
    assert.deepEqual(informationFiltersFromParams(new URLSearchParams(`sourceType=${invalid}&nature=${invalid}&verification=${invalid}`)), { sourceType: null, nature: null, verification: null });
  }
});
