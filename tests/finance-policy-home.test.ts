import { tag } from "./setup.ts";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { closeDb, sql } from "@aihot/backend/db";
import { stopBoss } from "@aihot/backend/jobs/queue";
import { loadTimeline } from "@aihot/backend/publication/timeline";
import { loadTopicTags, seedTopics } from "@aihot/backend/publication/topics";
import { buildApp } from "../apps/api/src/app.ts";

const T = tag();
const source = `policy-home-${T}`;
const app = await buildApp();
after(async () => {
  await sql`DELETE FROM articles WHERE source_id = ${source}`;
  await sql`DELETE FROM sources WHERE id = ${source}`;
  await app.close();
  await stopBoss();
  await closeDb();
});

test("policy feeds combine category, topic and tag across pages; official disclosures stay outside them", async () => {
  await seedTopics();
  await sql`INSERT INTO sources(id,name,kind,tier,first_party) VALUES(${source},'Fictional official policy test','rss','T1',true)`;
  const now = new Date("2026-10-03T00:00:00Z");
  const add = async (suffix: string, category: string, topic: string, selected = true) => {
    const id = `${T}-${suffix}`;
    const at = new Date(now.getTime() - 60_000);
    await sql`INSERT INTO articles(id,source_id,identity_key,url,title,discovered_at,timeline_at)
      VALUES(${id},${source},${id},'https://example.test/policy',${id},${at},${at})`;
    await sql`INSERT INTO publications(article_id,title,source_id,channel,first_party,url,discovered_at,timeline_at,sort_at,eligible,selected,visible_after,visibility,category,tags)
      VALUES(${id},${id},${source},'news',true,'https://example.test/policy',${at},${at},${at},true,${selected},${at},'public',${category},${[T, topic]})`;
    return id;
  };
  const expected = await Promise.all([add("fiscal-a","policy","财政政策"),add("fiscal-b","policy","财政政策"),add("fiscal-c","policy","财政政策")]);
  await add("disclosure","first-hand","财政政策");
  await add("flow","capital-flow","财政政策");
  await add("monetary","policy","货币政策");
  const unselected = await add("unselected","policy","财政政策",false);
  const query = { channel: "all" as const, category: "policy" as const, tag: T, topic: "policy-fiscal", topicTags: await loadTopicTags("policy-fiscal"), now, limit: 2 };
  const head = await loadTimeline(query);
  const tail = await loadTimeline({ ...query, cursor: head.nextCursor });
  assert.deepEqual([...head.cards,...tail.cards].map(c => c.item.id).sort(), expected.sort());
  assert.equal(tail.nextCursor, null);
  const response = await app.inject({ method: "GET", url: `/api/site/timeline?category=policy&topic=policy-fiscal&tag=${T}` });
  assert.equal(response.statusCode, 200);
  const timeline = response.json();
  assert.deepEqual(timeline.cards.map((c: {item:{id:string}}) => c.item.id).sort(), expected.sort());
  assert.equal(timeline.hot, null);
  assert.equal(timeline.filters.category, "policy");
  const pool = await app.inject({ method: "GET", url: `/api/site/pool?category=policy&topic=policy-fiscal&tag=${T}` });
  assert.equal(pool.statusCode, 200);
  assert.deepEqual(pool.json().items.map((i: {id:string}) => i.id).sort(), [...expected, unselected].sort());
});
