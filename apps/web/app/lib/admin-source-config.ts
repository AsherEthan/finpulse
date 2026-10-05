import type { SourceDimension } from "@aihot/contracts/site";
import { SOURCE_DIMENSION_LABELS } from "./information-labels.ts";

export function parseSourceConfig(text: string): Record<string, unknown> {
  let config: unknown;
  try {
    config = JSON.parse(text);
  } catch (e) {
    throw new Error(`配置不是合法 JSON：${(e as Error).message}`);
  }
  if (!config || typeof config !== "object" || Array.isArray(config)) throw new Error("采集配置必须是 JSON 对象");
  return config as Record<string, unknown>;
}

export function sourceAddressKey(kind: string, config: Record<string, unknown>): "feedUrl" | "url" | null {
  if (kind === "rss") return Object.hasOwn(config, "feedUrl") || !Object.hasOwn(config, "url") ? "feedUrl" : "url";
  return kind === "web_list" || kind === "json_list" ? "url" : null;
}

export function sourceConfigDimension(config: Record<string, unknown>): SourceDimension | null {
  const metadata = config._aihot;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>).sourceDimension;
  return typeof value === "string" && Object.hasOwn(SOURCE_DIMENSION_LABELS, value) ? value as SourceDimension : null;
}

/** Common fields edit the same JSON draft, preserving every collector option and metadata key. */
export function updateSourceConfig(text: string, change: { kind: string; address: string } | { dimension: SourceDimension | null }): string {
  const config = parseSourceConfig(text);
  if ("address" in change) {
    const key = sourceAddressKey(change.kind, config);
    if (!key) throw new Error("这个采集方式没有来源地址设置");
    config[key] = change.address;
  } else {
    const existing = config._aihot;
    if (existing !== undefined && (!existing || typeof existing !== "object" || Array.isArray(existing))) throw new Error("配置中的 _aihot 必须是对象，请在高级采集设置中修正");
    const metadata = { ...(existing as Record<string, unknown> | undefined) };
    if (change.dimension) metadata.sourceDimension = change.dimension;
    else delete metadata.sourceDimension;
    if (existing !== undefined || Object.keys(metadata).length) config._aihot = metadata;
  }
  return JSON.stringify(config, null, 2);
}

export function validateSourceAddress(kind: string, config: Record<string, unknown>): void {
  const key = sourceAddressKey(kind, config);
  if (!key) return;
  const address = config[key];
  try {
    if (typeof address !== "string" || !address.trim()) throw new Error();
    const url = new URL(address);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
  } catch {
    throw new Error("来源地址须为有效的 http 或 https 网址");
  }
}
