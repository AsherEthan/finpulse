import type { PolicySourceState } from "@aihot/contracts/policy-sources";
import type { SourceCatalogEntry } from "@aihot/contracts/sources";
import type { SourceDimension } from "@aihot/contracts/site";
import { SOURCE_DIMENSION_LABELS } from "./information-labels.ts";

export const SOURCE_STATE_LABELS: Record<PolicySourceState, string> = {
  ok: "采集成功", no_update: "无新增", failed: "采集失败",
  never_collected: "待首次采集", paused: "已暂停", stale: "检查逾期",
};

export interface SourceCatalogFilters {
  q: string;
  sourceType: SourceDimension | null;
  state: PolicySourceState | null;
  enabled: "true" | "false" | null;
  tag: string | null;
  page: number;
}

export function sourceCatalogFilters(params: URLSearchParams): SourceCatalogFilters {
  const pick = <T extends string>(key: string, labels: Record<T, string>): T | null => {
    const value = params.get(key);
    return value && Object.hasOwn(labels, value) ? value as T : null;
  };
  const enabled = params.get("enabled");
  const page = Number(params.get("page") ?? 1);
  return {
    q: (params.get("q") ?? "").trim().slice(0, 200),
    sourceType: pick("sourceType", SOURCE_DIMENSION_LABELS),
    state: pick("state", SOURCE_STATE_LABELS),
    enabled: enabled === "true" || enabled === "false" ? enabled : null,
    tag: params.get("tag")?.trim() || null,
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
  };
}

export function filterSourceCatalog(sources: SourceCatalogEntry[], filters: SourceCatalogFilters): SourceCatalogEntry[] {
  const words = filters.q.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return sources.filter(source => {
    if (filters.sourceType && source.sourceDimension !== filters.sourceType) return false;
    if (filters.state && source.state !== filters.state) return false;
    if (filters.enabled && source.enabled !== (filters.enabled === "true")) return false;
    if (filters.tag && !source.tags.includes(filters.tag)) return false;
    const text = [source.name, source.id, source.url ?? "", ...source.tags].join(" ").toLocaleLowerCase();
    return words.every(word => text.includes(word));
  });
}

/** Filter and tag navigation always starts on page one, preserving the other chosen dimensions. */
export function sourceCatalogHref(params: URLSearchParams, patch: Record<string, string | number | null>): string {
  const next = new URLSearchParams(params);
  next.delete("page");
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === "") next.delete(key);
    else next.set(key, String(value));
  }
  const query = next.toString();
  return `/sources${query ? `?${query}` : ""}`;
}
