// Public coverage metadata, separate from administrative source configs and raw fetch errors.
import { POLICY_TOPICS } from "@aihot/industry/taxonomy";
import limitations from "@aihot/industry/source-limitations.json" with { type: "json" };
import type { PolicySourceHealth, PolicySourceState, PolicySourcesResponse } from "@aihot/contracts/policy-sources";
import { sql } from "../db.ts";
import { listedCondition } from "./scope.ts";

interface SourceHealthRow {
  id: string; name: string; config: Record<string, unknown>; tags: string[]; enabled: boolean; interval_minutes: number;
  last_ok_at: Date | null; last_fetch_at: Date | null; last_error: string | null;
  run_status: string | null; started_at: Date | null; found_count: number; new_count: number; revised_count: number;
  window_from: Date | null; window_to: Date | null; detail: Record<string, unknown> | null;
  last_failure_at: Date | null; latest_published_at: Date | null; published_count: number; pending_count: number;
}

/** Never publish a provider response, credential-bearing URL or private error text. */
export function publicSourceFailure(error: string | null): string | null {
  if (!error) return null;
  const status = /\bHTTP\s+(\d{3})\b/i.exec(error)?.[1];
  if (status) return `原站返回 HTTP ${status}`;
  if (/timeout|timed out|abort/i.test(error)) return "原站读取超时";
  if (/no items|items path|not JSON|listing HTML/i.test(error)) return "原站列表格式变化，需重新核验";
  if (/unsupported config/i.test(error)) return "来源配置需重新核验";
  if (/budget/i.test(error)) return "采集预算已暂停";
  return "原站暂时无法读取";
}

function listingUrl(config: Record<string, unknown>): string | null {
  try {
    const url = new URL(String(config.url ?? config.feedUrl ?? ""));
    if (!/^https?:$/.test(url.protocol) || url.username || url.password) return null;
    for (const key of [...url.searchParams.keys()]) if (/key|token|secret|password|auth|signature/i.test(key)) url.searchParams.delete(key);
    return url.toString();
  } catch { return null; }
}

export function policySourceState(row: Pick<SourceHealthRow, "enabled" | "last_ok_at" | "last_fetch_at" | "run_status" | "started_at" | "interval_minutes" | "new_count" | "revised_count">, now = new Date()): PolicySourceState {
  if (!row.enabled) return "paused";
  if (row.run_status === "failed") return "failed";
  if (!row.last_fetch_at && !row.started_at) return "never_collected";
  if (!row.last_ok_at) return row.run_status === "running" ? "stale" : "failed";
  // A healthy source can legitimately publish nothing for weeks; freshness is the check time.
  if (now.getTime() - row.last_ok_at.getTime() > Math.max(row.interval_minutes * 3, 60) * 60_000) return "stale";
  return row.new_count === 0 && row.revised_count === 0 ? "no_update" : "ok";
}

export async function loadPolicySources(now = new Date()): Promise<PolicySourcesResponse> {
  const policyTags = ["政策/监管", ...POLICY_TOPICS.map((t) => t.tag)];
  const rows = await sql<SourceHealthRow[]>`
    SELECT s.id, s.name, s.config, s.tags, s.enabled, s.interval_minutes, s.last_ok_at, s.last_fetch_at, s.last_error,
      run.status AS run_status, run.started_at, coalesce(run.found_count, 0)::int AS found_count,
      coalesce(run.new_count, 0)::int AS new_count, coalesce(run.revised_count, 0)::int AS revised_count,
      run.window_from, run.window_to, run.detail, failure.started_at AS last_failure_at,
      (SELECT max(a.published_at) FROM articles a WHERE a.source_id = s.id) AS latest_published_at,
      (SELECT count(*)::int FROM publications p WHERE p.source_id = s.id AND p.category = 'policy' AND ${listedCondition(now)}) AS published_count,
      (SELECT count(*)::int FROM articles a WHERE a.source_id = s.id
        AND NOT EXISTS (SELECT 1 FROM publications p WHERE p.article_id = a.id AND p.eligible)
        AND NOT EXISTS (SELECT 1 FROM analyses an WHERE an.article_id = a.id)
        AND NOT EXISTS (SELECT 1 FROM editorial_overrides o WHERE o.article_id = a.id
          AND (o.fields->>'relevance' = 'block' OR o.visibility = 'withdrawn'))) AS pending_count
    FROM sources s
    LEFT JOIN LATERAL (SELECT status, started_at, found_count, new_count, revised_count, window_from, window_to, detail
      FROM fetch_runs WHERE source_id = s.id ORDER BY started_at DESC, id DESC LIMIT 1) run ON true
    LEFT JOIN LATERAL (SELECT started_at FROM fetch_runs WHERE source_id = s.id AND status = 'failed' ORDER BY started_at DESC LIMIT 1) failure ON true
    WHERE s.participation_mode = 'editorial' AND s.tags && ${policyTags}::text[]
    ORDER BY s.name, s.id`;
  const iso = (date: Date | null) => date?.toISOString() ?? null;
  const sources: PolicySourceHealth[] = rows.map((row) => ({
    id: row.id, name: row.name, url: listingUrl(row.config), topics: row.tags.filter((t) => policyTags.includes(t)),
    intervalMinutes: row.interval_minutes, enabled: row.enabled, state: policySourceState(row, now),
    lastAttemptAt: iso(row.started_at ?? row.last_fetch_at), lastSuccessAt: iso(row.last_ok_at), lastFailureAt: iso(row.last_failure_at),
    failureReason: publicSourceFailure(row.last_error), latestPublishedAt: iso(row.latest_published_at),
    lastRun: row.started_at ? { found: row.found_count, new: row.new_count, revised: row.revised_count,
      windowFrom: iso(row.window_from), windowTo: iso(row.window_to), pages: Number(row.detail?.pages ?? 1),
      truncated: row.detail?.truncated === true || row.detail?.initialBackfillLimited === true } : null,
    publishedCount: row.published_count, pendingReviewCount: row.pending_count,
  }));
  return {
    generatedAt: now.toISOString(),
    totals: { configured: sources.length, ok: sources.filter((s) => s.state === "ok").length,
      noUpdate: sources.filter((s) => s.state === "no_update").length, failed: sources.filter((s) => s.state === "failed").length,
      neverCollected: sources.filter((s) => s.state === "never_collected").length, paused: sources.filter((s) => s.state === "paused").length,
      stale: sources.filter((s) => s.state === "stale").length, pendingReview: sources.reduce((n, s) => n + s.pendingReviewCount, 0) },
    sources,
    limitations: limitations.sources.map((s) => ({ id: s.id, name: s.name ?? s.id, url: s.url, reason: s.reason })),
  };
}
