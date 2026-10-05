import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchGfexWarehouse, gfexCandidateDates, parseGfexWarehouse, GFEX_WAREHOUSE_API_URL } from "@aihot/backend/sources/gfex-warehouse";
import { FetchError, type SourceRow } from "@aihot/backend/sources/types";

// Anonymous official response checked on 2026-10-03; self-contained, never requests the network.
const warehouseNumbers = [
  ["005", "象屿速传上海", 3545, 3213, -332], ["017", "外运龙泉驿", 5558, 5458, -100],
  ["051", "中储临港", 180, 180, 0], ["052", "建发上海", 1131, 1131, 0],
  ["053", "中远海运临港", 580, 580, 0], ["054", "天诚高新", 6385, 6115, -270],
  ["056", "中远海运镇江", 8947, 8889, -58], ["058", "五矿无锡", 209, 209, 0],
  ["059", "江苏奔牛港务", 101, 101, 0], ["063", "九岭锂业（宜春奉新）", 500, 500, 0],
  ["067", "中远海运南昌", 3608, 3438, -170], ["071", "融捷集团", 640, 640, 0],
  ["075", "厦门国贸（中远海运镇江）", 150, 150, 0], ["076", "九岭锂业（宜春宜丰）", 500, 500, 0],
  ["083", "广东邦普（广东佛山）", 660, 660, 0], ["084", "广东邦普（湖北宜昌）", 526, 226, -300],
] as const;

function fixture(date = "20260930", variety = "lc", name = "碳酸锂") {
  const blank = { varietyOrder: "", groupCodeOrder: null, whCodeOrder: "", whType: "", genDate: "", whAbbr: "", trademarkName: "" };
  return {
    code: "0", time: 1791019103744, param: { gen_date: [date], variety: [variety] },
    data: [
      { ...blank, variety: "总计", lastWbillQty: 33220, wbillQty: 31990, diff: -1230 },
      ...warehouseNumbers.map(([code, warehouse, yesterday, today, diff]) => ({
        ...blank, varietyOrder: variety, whCodeOrder: code as string, whType: "2", variety: name, genDate: date,
        whAbbr: warehouse as string, lastWbillQty: yesterday as number, wbillQty: today as number, diff: diff as number,
      })),
      { ...blank, varietyOrder: variety, whCodeOrder: "wh_code_order", variety: `${name}小计`, lastWbillQty: 33220, wbillQty: 31990, diff: -1230 },
    ],
  };
}

function placeholder() {
  return { code: "0", data: [{ varietyOrder: "", whCodeOrder: "", variety: "总计", genDate: "", lastWbillQty: null, wbillQty: null, diff: null }] };
}

function source(config: SourceRow["config"] = {}): SourceRow {
  return { id: "gfex-test", name: "广期所仓单日报", kind: "json_list", config, tier: "core", participation_mode: "editorial", first_party: true, interval_minutes: 1440, enabled: true, cursor: null, fail_count: 0 };
}

function response(payload: unknown, status = 200) {
  return { status, text: () => JSON.stringify(payload) };
}

test("Shanghai dates include today and exactly six previous natural days across month, year and leap day", () => {
  assert.deepEqual(gfexCandidateDates(new Date("2026-10-02T16:00:00Z")), ["20261003", "20261002", "20261001", "20260930", "20260929", "20260928", "20260927"]);
  assert.equal(gfexCandidateDates(new Date("2026-10-02T15:59:59Z"))[0], "20261002");
  assert.deepEqual(gfexCandidateDates(new Date("2025-12-31T16:00:00Z")), ["20260101", "20251231", "20251230", "20251229", "20251228", "20251227", "20251226"]);
  assert.equal(gfexCandidateDates(new Date("2024-03-01T00:00:00+08:00"))[1], "20240229");
  assert.throws(() => gfexCandidateDates(new Date(NaN)), FetchError);
});

test("verified 18-row fixture counts 16 details once, cross-checks both summaries and ignores response time", () => {
  const report = parseGfexWarehouse(fixture(), "20260930")!;
  assert.deepEqual([report.lastWbillQty, report.wbillQty, report.diff], [33220, 31990, -1230]);
  assert.equal(report.details.length, 16);
  assert.equal(report.totalBasis, "variety-subtotal");
  const reordered = fixture();
  reordered.data.reverse();
  reordered.time += 1;
  assert.deepEqual(parseGfexWarehouse(reordered, "20260930"), report);
  const totalOnly = fixture();
  totalOnly.data.pop();
  assert.equal(parseGfexWarehouse(totalOnly, "20260930")!.totalBasis, "total");
});

test("only empty arrays and the actual undated null placeholder mean no data; real dated zeros remain measurements", () => {
  assert.equal(parseGfexWarehouse({ code: 0, data: [] }, "20260930"), null);
  assert.equal(parseGfexWarehouse(placeholder(), "20260930"), null);
  const zero = fixture();
  zero.data.forEach((row) => { row.lastWbillQty = 0; row.wbillQty = 0; row.diff = 0; });
  assert.equal(parseGfexWarehouse(zero, "20260930")!.wbillQty, 0);
  const totalsOnly = fixture();
  totalsOnly.data = [zero.data[0]!];
  assert.throws(() => parseGfexWarehouse(totalsOnly, "20260930"), /without dated warehouse details/);
  const incomplete = placeholder();
  incomplete.data[0]!.wbillQty = 0 as never;
  assert.throws(() => parseGfexWarehouse(incomplete, "20260930"), /invalid/);
});

test("mixed, missing or stale detail dates, unexpected varieties and duplicated identities fail closed", () => {
  for (const date of ["20260929", "", "20261001"]) {
    const payload = fixture();
    payload.data[1]!.genDate = date;
    assert.throws(() => parseGfexWarehouse(payload, "20260930"), /detail date mismatch/);
  }
  const otherVariety = fixture();
  otherVariety.data[1]!.varietyOrder = "si";
  assert.throws(() => parseGfexWarehouse(otherVariety, "20260930"), /unexpected/);
  const duplicate = fixture();
  duplicate.data.push({ ...duplicate.data[1]! });
  assert.throws(() => parseGfexWarehouse(duplicate, "20260930"), /duplicate warehouse detail/);
  const wrongName = fixture();
  wrongName.data[1]!.variety = "其他品种";
  assert.throws(() => parseGfexWarehouse(wrongName, "20260930"), /inconsistent variety name/);
  assert.throws(() => parseGfexWarehouse(fixture(), "20260230"), /invalid statistical date/);
});

test("quantity validation rejects coerced empties, fractions, non-finite values, negatives and unsafe integers", () => {
  for (const value of [null, undefined, "", "31990", false, [], {}, NaN, Infinity, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    const payload = fixture();
    (payload.data[1] as Record<string, unknown>).wbillQty = value;
    assert.throws(() => parseGfexWarehouse(payload, "20260930"), /invalid wbillQty/);
  }
  const incorrectDiff = fixture();
  incorrectDiff.data[1]!.diff = 1;
  assert.throws(() => parseGfexWarehouse(incorrectDiff, "20260930"), /inconsistent row change/);
});

test("duplicate, missing, mislabeled or inconsistent summaries cannot silently inflate or hide warehouse totals", () => {
  for (const index of [0, 17]) {
    const duplicate = fixture();
    duplicate.data.push({ ...duplicate.data[index]! });
    assert.throws(() => parseGfexWarehouse(duplicate, "20260930"), /duplicate (total|subtotal)/);
    const mismatch = fixture();
    mismatch.data[index]!.wbillQty += 1;
    mismatch.data[index]!.diff += 1;
    assert.throws(() => parseGfexWarehouse(mismatch, "20260930"), /summary does not match/);
  }
  const missing = fixture();
  missing.data = missing.data.slice(1, -1);
  assert.throws(() => parseGfexWarehouse(missing, "20260930"), /missing summary/);
  const wrongSubtotal = fixture();
  wrongSubtotal.data[17]!.variety = "工业硅小计";
  assert.throws(() => parseGfexWarehouse(wrongSubtotal, "20260930"), /subtotal variety mismatch/);
});

test("latest validated date is discovered newest first, stops after hit and overrides any static configured date", async () => {
  const dates: string[] = [];
  const candidates = await fetchGfexWarehouse(source({ url: GFEX_WAREHOUSE_API_URL, method: "POST", bodyForm: { variety: "lc", gen_date: "20000101" } }), {
    now: new Date("2026-10-03T09:18:23Z"),
    fetch: async (url, options) => {
      assert.equal(url, GFEX_WAREHOUSE_API_URL);
      assert.equal(options.method, "POST");
      assert.equal(options.redirectPolicy, "same-origin");
      assert.equal(options.maxRedirects, 0);
      assert.equal(options.headers?.["content-type"], "application/x-www-form-urlencoded");
      assert.equal(options.headers?.referer, "http://www.gfex.com.cn/gfex/cdrb/hqsj_tjsj.shtml");
      assert.ok(options.maxBytes! <= 1_048_576 && options.timeoutMs! <= 15_000);
      const form = new URLSearchParams(options.body);
      assert.equal(form.get("variety"), "lc");
      const date = form.get("gen_date")!;
      dates.push(date);
      return response(date === "20260930" ? fixture() : placeholder());
    },
  });
  assert.deepEqual(dates, ["20261003", "20261002", "20261001", "20260930"]);
  assert.equal(candidates.length, 1);
  const candidate = candidates[0]!;
  assert.equal(candidate.url, "http://www.gfex.com.cn/gfex/cdrb/hqsj_tjsj.shtml");
  assert.equal(candidate.identityKey, "gfex-cdrb:20260930:lc");
  assert.equal(candidate.publishedAt, null);
  assert.equal(candidate.bodyStatus, "ok");
  assert.match(candidate.title, /2026-09-30.*31990手/);
  assert.match(candidate.bodyText!, /2026-09-30.*31990手.*1230手.*33220手/);
  const raw = candidate.raw as { externalId: string; officialMetadata: Record<string, unknown> };
  assert.equal(raw.externalId, "gfex-cdrb:20260930:lc");
  assert.equal(raw.officialMetadata.unit, "手");
  assert.equal(raw.officialMetadata.publicationTimeKnown, false);
  assert.equal(raw.officialMetadata.warehouseCount, 16);
  assert.deepEqual(raw.officialMetadata.attemptedDates, dates);
});

test("all seven genuine empty dates stop at the bound and produce no zero report", async () => {
  const dates: string[] = [];
  const candidates = await fetchGfexWarehouse(source(), {
    now: new Date("2026-10-03T00:00:00+08:00"),
    fetch: async (_url, options) => { dates.push(new URLSearchParams(options.body).get("gen_date")!); return response(placeholder()); },
  });
  assert.deepEqual(candidates, []);
  assert.equal(dates.length, 7);
  assert.equal(dates[6], "20260927");
});

test("HTTP, JSON, business-code, transport and date errors abort instead of treating failed dates as holidays", async () => {
  const failures = [
    async () => response({}, 412),
    async () => ({ status: 200, text: () => "<html>challenge</html>" }),
    async () => response({ code: "1", data: null }),
    async () => { throw new Error("timeout"); },
    async () => response(fixture("20260929")),
  ];
  for (const fail of failures) {
    let calls = 0;
    await assert.rejects(fetchGfexWarehouse(source(), { now: new Date("2026-09-30T10:00:00+08:00"), fetch: async () => { calls++; return fail(); } }));
    assert.equal(calls, 1);
  }
});

test("daily and variety identities differ; same-day response noise is stable and corrected numbers change content", async () => {
  async function candidate(date: string, payload: ReturnType<typeof fixture>, variety = "lc") {
    return (await fetchGfexWarehouse(source({ bodyForm: { variety } }), { now: new Date(`${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)}T10:00:00+08:00`), fetch: async () => response(payload) }))[0]!;
  }
  const first = await candidate("20260930", fixture());
  const reordered = fixture();
  reordered.data.reverse();
  reordered.time = 1;
  const repeated = await candidate("20260930", reordered);
  assert.equal(first.identityKey, repeated.identityKey);
  assert.equal(first.bodyText, repeated.bodyText);
  assert.notEqual(first.identityKey, (await candidate("20260929", fixture("20260929"))).identityKey);
  assert.notEqual(first.identityKey, (await candidate("20260930", fixture("20260930", "si", "工业硅"), "si")).identityKey);
  const corrected = fixture();
  for (const index of [0, 1, 17]) { corrected.data[index]!.wbillQty += 1; corrected.data[index]!.diff += 1; }
  const correction = await candidate("20260930", corrected);
  assert.equal(first.identityKey, correction.identityKey);
  assert.notEqual(first.bodyText, correction.bodyText);
});

test("adapter refuses non-official endpoints and unsupported request configuration without any request", async () => {
  for (const config of [{ url: "https://example.com/" }, { method: "GET" }, { bodyJson: {} }, { bodyForm: [] }, { bodyForm: { variety: null } }, { bodyForm: { variety: "lc", extra: "x" } }]) {
    await assert.rejects(fetchGfexWarehouse(source(config), { fetch: async () => { throw new Error("unexpected request"); } }), FetchError);
  }
});
