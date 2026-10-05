import { tag } from "./setup.ts";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import type { PgBoss } from "pg-boss";
import { sql, closeDb } from "@aihot/backend/db";
import { registerPublicSourceJobs } from "@aihot/backend/jobs/sources";
import { QUEUES, stopBoss } from "@aihot/backend/jobs/queue";
import { upsertMaterial } from "@aihot/backend/content/materials";
import { registerCollectionSchedules } from "../apps/worker/src/collection-schedules.ts";
import { workerMode } from "../apps/worker/src/mode.ts";

const T = tag();
after(async () => { await stopBoss(); await closeDb(); });

test("collection worker cannot register paid, model, publishing or push jobs", async () => {
  const handlers = new Map<string, (jobs: Array<{ data: unknown }>) => Promise<unknown>>();
  const unscheduled: string[] = [];
  const boss = {
    work: async (name: string, _opts: unknown, fn: (jobs: Array<{ data: unknown }>) => Promise<unknown>) => { handlers.set(name, fn); },
    schedule: async () => {},
    getSchedules: async () => [{ name: "cron.reports.daily" }, { name: "cron.sources.mp-reconcile" }, { name: "cron.sources.schedule" }],
    unschedule: async (name: string) => { unscheduled.push(name); },
  } as unknown as PgBoss;
  await registerPublicSourceJobs(boss);
  await registerCollectionSchedules(boss);
  assert.deepEqual([...handlers.keys()].sort(), [QUEUES.fetchSource, QUEUES.extractBody, "cron.sources.schedule", "cron.content.sweep"].sort());
  assert.deepEqual(unscheduled, ["cron.reports.daily", "cron.sources.mp-reconcile"]);
  assert.equal(workerMode(undefined), "full");
  assert.equal(workerMode("collection"), "collection");
  assert.throws(() => workerMode("typo"), /WORKER_MODE/);

  // A paid collector's job left in the database before the mode switch stays unconsumed.
  const source = `collection-x-${T}`;
  await sql`INSERT INTO sources (id,name,kind,site_fulltext,enabled,next_fetch_at) VALUES (${source}, 'Test X', 'x_search', false, false, '2100-01-01')`;
  const { articleId } = await upsertMaterial({ sourceId: source, url: `https://x.com/test/status/${Date.now()}`, title: "Test queued X article", via: "import" });
  const before = await sql`SELECT id FROM receipts`;
  assert.deepEqual(await handlers.get(QUEUES.extractBody)!([{ data: { articleId } }]), { state: "skipped" });
  assert.equal((await sql`SELECT id FROM receipts`).length, before.length);
  assert.equal((await sql`SELECT body_status FROM articles WHERE id=${articleId}`)[0]!.body_status, "pending");
});
