import assert from "node:assert/strict";
import { test } from "node:test";
import { homeFilters, homeRedirect } from "../app/lib/home-filters.ts";

test("home defaults to all selected content and keeps each chosen category", () => {
  for (const category of ["first-hand", "capital-flow", "supply-chain", "policy", "papers"]) {
    assert.equal(homeFilters(new URLSearchParams({ category })).category, category);
  }
  assert.equal(homeFilters(new URLSearchParams()).category, null);
  assert.equal(homeFilters(new URLSearchParams({ category: "unknown" })).category, null);
});

test("home preserves the original channel and tag filters without imposing policy topics", () => {
  assert.deepEqual(homeFilters(new URLSearchParams({ tag: " 政策执行 ", channel: "firstParty" })), {
    category: null, channel: "firstParty", topic: null, tag: "政策执行",
  });
  assert.equal(homeFilters(new URLSearchParams({ topic: "policy-fiscal" })).topic, null);
});

test("existing category links remain on the selected feed", () => {
  assert.equal(homeRedirect(new URLSearchParams({ category: "capital-flow", tag: "流动性" })), null);
  assert.equal(homeRedirect(new URLSearchParams()), null);
});

test("home search retains chosen filters and does not add a policy filter", () => {
  const target = new URL(homeRedirect(new URLSearchParams({ q: "专项债", category: "capital-flow", tag: "流动性" }))!, "http://local");
  assert.equal(target.pathname, "/all");
  assert.equal(target.searchParams.get("category"), "capital-flow");
  assert.equal(target.searchParams.get("tag"), "流动性");
  const all = new URL(homeRedirect(new URLSearchParams({ q: "央行" }))!, "http://local");
  assert.equal(all.searchParams.get("category"), null);
});

test("selected home accepts main-column and first-party filters together without redirecting", () => {
  for (const category of ["first-hand", "supply-chain", "policy", "capital-flow", "papers"]) {
    const params = new URLSearchParams({ category, channel: "firstParty" });
    assert.equal(homeFilters(params).category, category);
    assert.equal(homeFilters(params).channel, "firstParty");
    assert.equal(homeRedirect(params), null);
  }
});
