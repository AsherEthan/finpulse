import type { PgBoss } from "pg-boss";
import { ensureQueue, recordRun } from "@aihot/backend/jobs/queue";
import { sweepUnprocessed } from "@aihot/backend/jobs/content";
import { scheduleDueSources } from "@aihot/backend/sources/collect";

/** Collection mode registers no publishing, model, paid collector or notification schedules. */
export async function registerCollectionSchedules(boss: PgBoss) {
  const schedules = [
    { name: "sources.schedule", cron: "* * * * *", run: () => scheduleDueSources(undefined, { publicOnly: true }) },
    { name: "content.sweep", cron: "*/5 * * * *", run: sweepUnprocessed },
  ];
  for (const schedule of schedules) {
    const queue = `cron.${schedule.name}`;
    await ensureQueue(queue, { policy: "singleton", retryLimit: 1, expireInSeconds: 3600 });
    await boss.schedule(queue, schedule.cron, {}, { tz: "Asia/Shanghai", missed: "skip" });
    await boss.work(queue, { pollingIntervalSeconds: 15 }, async () => recordRun(schedule.name, schedule.run));
  }
  const names = new Set(schedules.map((s) => `cron.${s.name}`));
  for (const existing of await boss.getSchedules()) {
    if (existing.name.startsWith("cron.") && !names.has(existing.name)) await boss.unschedule(existing.name);
  }
}
