import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { normalizeTags } from "@aihot/backend/editorial/vocabulary";
import { sourceDimension } from "@aihot/backend/content/information";
import { CATEGORY_KEYS, CATEGORY_LABELS, isCategoryKey, toPublicApiCategory } from "@aihot/contracts/taxonomy";
import { CATEGORY_TAGS, DISCLOSURE_TOPICS, ECONOMICS_TOPICS, TOPIC_TAGS } from "@aihot/industry/taxonomy";

test("extra type labels cannot pull a policy item into disclosure or industry type topics", () => {
  assert.deepEqual(
    normalizeTags(["政策/监管", "公告/财报", "产业链", "能源", "能源", "中国人民银行"]),
    ["政策/监管", "能源", "中国人民银行"],
  );
});

test("a comprehensive financial report retains its report theme after type normalization", () => {
  assert.deepEqual(
    normalizeTags(["公告/财报", "财报", "汽车与动力电池", "库存", "季度"]),
    ["公告/财报", "财报", "汽车与动力电池", "库存", "季度"],
  );
});

test("analysis keeps its content type and its policy theme independently", () => {
  assert.deepEqual(normalizeTags(["分析/解读", "政策/监管", "货币政策"]), ["分析/解读", "货币政策"]);
});

test("source identity cannot be emitted as a topic, and fallback keeps factual industry tags", () => {
  assert.deepEqual(
    normalizeTags(["一手", "firstParty", "汽车与动力电池", "交付", "月度", "未知标签"], { fallbackCategory: "产业链" }),
    ["产业链", "汽车与动力电池", "交付", "月度"],
  );
});

test("papers is a public category while research remains an independent source dimension", () => {
  assert.deepEqual(CATEGORY_KEYS, ["first-hand", "supply-chain", "policy", "capital-flow", "papers"], "existing category keys and order stay stable");
  assert.equal(CATEGORY_LABELS.papers, "论文");
  assert.equal(isCategoryKey("papers"), true);
  assert.equal(toPublicApiCategory("papers"), "papers");
  assert.equal(sourceDimension("research", false), "research");
  assert.equal(sourceDimension("research", true), "research");
  assert.equal(isCategoryKey("research"), false, "a source dimension cannot be passed as a main category");
});

test("the papers topic uses an explicit paper tag rather than the broad research and data type", () => {
  const topics = JSON.parse(readFileSync(new URL("../industry/topics.json", import.meta.url), "utf8")) as {
    topics: Array<{ slug: string; group: string; tags: string[] }>;
  };
  const papers = topics.topics.filter((topic) => topic.slug === "papers");
  assert.equal(papers.length, 1);
  assert.equal(papers[0]!.group, "genre");
  assert.deepEqual(papers[0]!.tags, ["论文"]);
  assert.ok((TOPIC_TAGS as readonly string[]).includes("论文"));
  assert.ok(!(CATEGORY_TAGS as readonly string[]).includes("论文"), "paper membership is an independent topic tag");

  const belongs = (tags: string[]) => papers[0]!.tags.some((tag) => normalizeTags(tags).includes(tag));
  assert.deepEqual(normalizeTags(["研究/数据", "论文", "中国", "货币政策"]), ["研究/数据", "论文", "中国", "货币政策"]);
  assert.equal(belongs(["研究/数据", "论文", "中国", "货币政策"]), true, "an explicitly classified working paper enters the paper topic");
  for (const [name, tags] of [
    ["annual WDI credit data", ["研究/数据", "信贷/社融", "年度", "中国"]],
    ["routine consumer survey", ["研究/数据", "调查指数", "消费", "月度"]],
    ["PMI release", ["产业链", "调查指数", "月度"]],
    ["warehouse inventory table", ["产业链", "库存", "日度"]],
    ["media commentary on a paper", ["分析/解读", "货币政策", "中国"]],
  ] as const) {
    assert.equal(belongs([...tags]), false, name);
  }
});

test("economics subjects survive classification independently of paper membership", () => {
  const catalog = JSON.parse(readFileSync(new URL("../industry/topics.json", import.meta.url), "utf8")) as {
    topics: Array<{ slug: string; tags: string[] }>;
  };
  for (const topic of ECONOMICS_TOPICS) {
    assert.deepEqual(catalog.topics.find(t => t.slug === topic.slug)?.tags, [topic.tag]);
    assert.deepEqual(normalizeTags(["研究/数据", "论文", topic.tag]), ["研究/数据", "论文", topic.tag]);
    assert.deepEqual(normalizeTags(["研究/数据", topic.tag]), ["研究/数据", topic.tag], "an economics subject alone must not label ordinary data as a paper");
  }
});

test("disclosure subjects remain searchable without changing the material type or adding paper membership", () => {
  const catalog = JSON.parse(readFileSync(new URL("../industry/topics.json", import.meta.url), "utf8")) as {
    topics: Array<{ slug: string; tags: string[] }>;
  };
  for (const topic of DISCLOSURE_TOPICS) {
    assert.deepEqual(catalog.topics.find(t => t.slug === topic.slug)?.tags, [topic.tag]);
    assert.deepEqual(normalizeTags(["研究/数据", topic.tag]), ["研究/数据", topic.tag]);
    assert.deepEqual(normalizeTags(["公告/财报", topic.tag]), ["公告/财报", topic.tag]);
  }
});
