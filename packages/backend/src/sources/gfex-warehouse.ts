// GFEX's warehouse table has undated totals and null holiday placeholders, not article rows.
import { guardedFetch, type GuardedFetchOptions, type GuardedResponse } from "../lib/http-fetch.ts";
import { FetchError, type Candidate, type SourceRow } from "./types.ts";

export const GFEX_WAREHOUSE_API_URL = "http://www.gfex.com.cn/u/interfacesWebTdWbillWeeklyQuotes/loadList";
export const GFEX_WAREHOUSE_PAGE_URL = "http://www.gfex.com.cn/gfex/cdrb/hqsj_tjsj.shtml";

interface Quantities {
  lastWbillQty: number;
  wbillQty: number;
  diff: number;
}

export interface GfexWarehouseDetail extends Quantities {
  warehouseCode: string;
  warehouseName: string;
  warehouseType: string;
  trademarkName: string;
}

export interface GfexWarehouseReport extends Quantities {
  statisticalDate: string;
  varietyCode: string;
  varietyName: string;
  totalBasis: "variety-subtotal" | "total";
  details: GfexWarehouseDetail[];
}

type GfexTransport = (url: string, options: GuardedFetchOptions) => Promise<Pick<GuardedResponse, "status" | "text">>;

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new FetchError("GFEX: expected an object");
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  if (typeof value !== "string") throw new FetchError("GFEX: expected a string field");
  return value.trim();
}

function dateAtMidnight(value: string): Date {
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
  const date = match ? new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`) : null;
  if (!date || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10).replaceAll("-", "") !== value) {
    throw new FetchError("GFEX: invalid statistical date");
  }
  return date;
}

/** Seven natural days in Shanghai, including today; no inferred trading-day/holiday calendar. */
export function gfexCandidateDates(now = new Date()): string[] {
  if (!Number.isFinite(now.getTime())) throw new FetchError("GFEX: invalid clock");
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const day = ["year", "month", "day"].map((type) => parts.find((part) => part.type === type)!.value).join("");
  const start = dateAtMidnight(day).getTime();
  return Array.from({ length: 7 }, (_, offset) => new Date(start - offset * 86_400_000).toISOString().slice(0, 10).replaceAll("-", ""));
}

function quantities(row: Record<string, unknown>): Quantities {
  const out = {} as Quantities;
  for (const key of ["lastWbillQty", "wbillQty", "diff"] as const) {
    const value = row[key];
    // In particular, Number(null), Number("") and Number(false) are not measurements.
    if (typeof value !== "number" || !Number.isSafeInteger(value) || (key !== "diff" && value < 0)) {
      throw new FetchError(`GFEX: invalid ${key}`);
    }
    out[key] = value;
  }
  if (out.wbillQty - out.lastWbillQty !== out.diff) throw new FetchError("GFEX: inconsistent row change");
  return out;
}

function detailKey(row: GfexWarehouseDetail): string {
  return JSON.stringify([row.warehouseCode, row.warehouseType, row.trademarkName]);
}

/** Null means verified no data. Malformed or inconsistent data fail closed, never become zero. */
export function parseGfexWarehouse(payload: unknown, requestedDate: string, varietyCode = "lc"): GfexWarehouseReport | null {
  dateAtMidnight(requestedDate);
  const response = object(payload);
  if (response.code !== "0" && response.code !== 0) throw new FetchError("GFEX: unsuccessful API code");
  if (!Array.isArray(response.data)) throw new FetchError("GFEX: data is not an array");
  const rows = response.data.map(object);
  if (rows.length === 0) return null;
  const first = rows[0]!;
  if (rows.length === 1 && first.variety === "总计" && first.genDate === "" && first.varietyOrder === "" && first.whCodeOrder === ""
    && first.lastWbillQty === null && first.wbillQty === null && first.diff === null) return null;

  const details: GfexWarehouseDetail[] = [];
  const seen = new Set<string>();
  let varietyName = "";
  let total: Quantities | null = null;
  let subtotal: Quantities | null = null;
  let subtotalName = "";
  for (const row of rows) {
    const code = text(row.whCodeOrder);
    const variety = text(row.variety);
    const order = text(row.varietyOrder);
    const date = text(row.genDate);
    if (variety === "总计" && code === "" && order === "") {
      if (total) throw new FetchError("GFEX: duplicate total");
      if (date && date !== requestedDate) throw new FetchError("GFEX: total date mismatch");
      total = quantities(row);
    } else if (code === "wh_code_order" && (order === "" || order === varietyCode)) {
      if (subtotal) throw new FetchError("GFEX: duplicate subtotal");
      if (date && date !== requestedDate) throw new FetchError("GFEX: subtotal date mismatch");
      subtotal = quantities(row);
      subtotalName = variety;
    } else {
      if (order !== varietyCode || !code || code === "wh_code_order") throw new FetchError("GFEX: unexpected warehouse row or variety");
      // Check every detail before aggregation: filtering bad rows would hide mixed/stale dates.
      if (date !== requestedDate) throw new FetchError("GFEX: detail date mismatch");
      if (!variety || (varietyName && varietyName !== variety)) throw new FetchError("GFEX: inconsistent variety name");
      varietyName = variety;
      const detail: GfexWarehouseDetail = {
        warehouseCode: code, warehouseName: text(row.whAbbr), warehouseType: text(row.whType),
        trademarkName: text(row.trademarkName), ...quantities(row),
      };
      if (!detail.warehouseName || !detail.warehouseType) throw new FetchError("GFEX: missing warehouse identity");
      const key = detailKey(detail);
      if (seen.has(key)) throw new FetchError("GFEX: duplicate warehouse detail");
      seen.add(key);
      details.push(detail);
    }
  }
  if (!details.length) throw new FetchError("GFEX: totals without dated warehouse details");
  if (!subtotal && !total) throw new FetchError("GFEX: missing summary row");
  if (subtotal && subtotalName !== `${varietyName}小计`) throw new FetchError("GFEX: subtotal variety mismatch");
  const sums: Quantities = { lastWbillQty: 0, wbillQty: 0, diff: 0 };
  for (const detail of details) {
    for (const key of ["lastWbillQty", "wbillQty", "diff"] as const) {
      sums[key] += detail[key];
      if (!Number.isSafeInteger(sums[key])) throw new FetchError("GFEX: unsafe warehouse sum");
    }
  }
  for (const summary of [subtotal, total]) {
    if (summary && Object.keys(sums).some((key) => summary[key as keyof Quantities] !== sums[key as keyof Quantities])) {
      throw new FetchError("GFEX: summary does not match warehouse sums");
    }
  }
  // Row order and interface response time are not content revisions.
  details.sort((a, b) => detailKey(a) < detailKey(b) ? -1 : detailKey(a) > detailKey(b) ? 1 : 0);
  return { statisticalDate: requestedDate, varietyCode, varietyName, totalBasis: subtotal ? "variety-subtotal" : "total", details, ...sums };
}

/** Returns one dated synthesis of the official table; does not fetch a generic page as article body. */
export async function fetchGfexWarehouse(source: SourceRow, options: { now?: Date; fetch?: GfexTransport } = {}): Promise<Candidate[]> {
  const c = source.config;
  if (c.url !== undefined && c.url !== GFEX_WAREHOUSE_API_URL) throw new FetchError("GFEX: use the verified official warehouse endpoint");
  if (c.method !== undefined && String(c.method).toUpperCase() !== "POST") throw new FetchError("GFEX: warehouse endpoint requires POST");
  if (c.bodyJson !== undefined) throw new FetchError("GFEX: warehouse endpoint requires form fields");
  const bodyForm = c.bodyForm === undefined ? {} : object(c.bodyForm);
  if (Object.keys(bodyForm).some((key) => key !== "variety" && key !== "gen_date")) throw new FetchError("GFEX: unsupported form field");
  const varietyCode = bodyForm.variety === undefined ? "lc" : text(bodyForm.variety);
  if (!/^[a-z]{2,10}$/.test(varietyCode)) throw new FetchError("GFEX: invalid variety code");
  const headers = new Headers({
    accept: "application/json", "user-agent": "Mozilla/5.0", referer: GFEX_WAREHOUSE_PAGE_URL, ...(c.headers ?? {}),
  });
  headers.set("content-type", "application/x-www-form-urlencoded");
  const fetch = options.fetch ?? guardedFetch;
  const dates = gfexCandidateDates(options.now);
  const attemptedDates: string[] = [];
  for (const date of dates) {
    attemptedDates.push(date);
    // A static configured gen_date must never freeze the collector on an old observation.
    const body = new URLSearchParams({ gen_date: date, variety: varietyCode }).toString();
    const res = await fetch(GFEX_WAREHOUSE_API_URL, {
      method: "POST", body, headers: Object.fromEntries(headers), redirectPolicy: "same-origin",
      timeoutMs: 15_000, maxBytes: 1_048_576, maxRedirects: 0,
    });
    if (res.status !== 200) throw new FetchError(`GFEX: HTTP ${res.status}`, res.status);
    let payload: unknown;
    try { payload = JSON.parse(res.text()); }
    catch { throw new FetchError("GFEX: response is not JSON"); }
    const report = parseGfexWarehouse(payload, date, varietyCode);
    if (!report) continue;
    const isoDate = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
    const change = report.diff < 0 ? `减少${-report.diff}` : report.diff > 0 ? `增加${report.diff}` : "不变（0）";
    const summary = `${isoDate}统计日，广期所${report.varietyName}仓单${report.wbillQty}手，较上日${change}手；昨日${report.lastWbillQty}手。统计截止交易日下午3点，仓单数量不等于社会总库存。原文页面需选择对应统计日查看。`;
    return [{
      url: GFEX_WAREHOUSE_PAGE_URL, identityKey: `gfex-cdrb:${date}:${varietyCode}`,
      title: `广期所${isoDate}${report.varietyName}仓单日报：${report.wbillQty}手`,
      author: "广州期货交易所", language: "zh-CN", publishedAt: null,
      excerpt: summary, bodyText: summary, bodyStatus: "ok",
      raw: {
        externalId: `gfex-cdrb:${date}:${varietyCode}`,
        officialMetadata: {
          statisticalDate: isoDate, genDate: date, varietyCode, varietyName: report.varietyName,
          unit: "手", statisticalCutoff: "交易日下午3点（Asia/Shanghai）", publicationTimeKnown: false,
          dateMeaning: "统计日，非发布时间；接口 time 为响应时间，不作为发布时间",
          scope: "交易所仓单数量，不等于社会总库存", synthetic: true,
          lastWbillQty: report.lastWbillQty, wbillQty: report.wbillQty, diff: report.diff,
          warehouseCount: report.details.length, totalBasis: report.totalBasis, warehouseDetails: report.details,
          validation: "全部明细日期等于请求日；逐行差额与明细合计分别核对；总计/小计不重复相加",
          attemptedDates, maxNaturalDays: 7, apiUrl: GFEX_WAREHOUSE_API_URL, documentUrl: GFEX_WAREHOUSE_PAGE_URL,
          publicUse: "仅归纳公开原始数值并链接官网；未核验批量数据再分发许可",
        },
      },
    }];
  }
  // A long closure can exceed this window. No inferred zero report or unbounded retry.
  return [];
}
