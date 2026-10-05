// Public source directory. Only display fields are read; private configs and fetch errors stay private.
import type { SourceCatalogEntry, SourceCatalogResponse } from "@aihot/contracts/sources";
import { sourceDimension } from "../content/information.ts";
import { sql } from "../db.ts";
import { policySourceState } from "./policy-sources.ts";
import { displayTags } from "./rules.ts";
import { listedCondition } from "./scope.ts";

interface SourceCatalogRow {
  id: string; name: string; listing_url: string | null; tags: string[]; source_dimension: unknown;
  first_party: boolean; tier: string; enabled: boolean; interval_minutes: number;
  last_ok_at: Date | null; last_fetch_at: Date | null; run_status: string | null; started_at: Date | null;
  new_count: number; revised_count: number; published_count: number;
}

/** Query strings may contain credentials under arbitrary names, so none are public directory links. */
export function publicSourceUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password) return null;
    const path = decodeURIComponent(url.pathname);
    if (/bearer\b|(?:api[_-]?key|access[_-]?token|auth(?:orization)?|password|secret|credential|signature)\s*[=:/]/i.test(path)) return null;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch { return null; }
}

export async function loadSourceCatalog(now = new Date()): Promise<SourceCatalogResponse> {
  const rows = await sql<SourceCatalogRow[]>`
    SELECT s.id, s.name, coalesce(nullif(s.config->>'url', ''), s.config->>'feedUrl') AS listing_url,
      s.tags, s.config#>>'{_aihot,sourceDimension}' AS source_dimension, s.first_party, s.tier, s.enabled,
      s.interval_minutes, s.last_ok_at, s.last_fetch_at, run.status AS run_status, run.started_at,
      coalesce(run.new_count, 0)::int AS new_count, coalesce(run.revised_count, 0)::int AS revised_count,
      (SELECT count(*)::int FROM publications p WHERE p.source_id = s.id AND ${listedCondition(now)}) AS published_count
    FROM sources s
    LEFT JOIN LATERAL (SELECT status, started_at, new_count, revised_count FROM fetch_runs
      WHERE source_id = s.id ORDER BY started_at DESC, id DESC LIMIT 1) run ON true
    WHERE s.participation_mode IN ('editorial', 'hot_signal')
    ORDER BY s.name, s.id`;
  const iso = (date: Date | null) => date?.toISOString() ?? null;
  const sources: SourceCatalogEntry[] = rows.map((row) => ({
    id: row.id, name: row.name, url: publicSourceUrl(row.listing_url), tags: displayTags(row.tags),
    sourceDimension: sourceDimension(row.source_dimension, row.first_party), firstParty: row.first_party,
    tier: row.tier, enabled: row.enabled, intervalMinutes: row.interval_minutes, state: policySourceState(row, now),
    lastSuccessAt: iso(row.last_ok_at), lastAttemptAt: iso(row.started_at ?? row.last_fetch_at),
    publishedCount: row.published_count,
  }));
  return { generatedAt: now.toISOString(), sources };
}
