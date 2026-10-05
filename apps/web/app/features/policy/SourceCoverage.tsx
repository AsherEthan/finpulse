import type { PolicySourcesResponse, PolicySourceState } from "@aihot/contracts/policy-sources";
import { fullDateTime } from "../../lib/format";
import { publicEvidenceUrl } from "../../lib/policy-filters";

const STATE_LABELS: Record<PolicySourceState, string> = { ok: "采集成功", no_update: "无新增", failed: "采集失败", never_collected: "待首次采集", paused: "暂停", stale: "更新逾期" };
const date = (value: string | null) => value ? fullDateTime(value) : "—";

export function SourceCoverage({ data }: { data: PolicySourcesResponse | null }) {
  if (!data) return <p className="mb-5 text-[12px] text-ink-4">来源覆盖状态暂时不可用。</p>;
  const totals = data.totals;
  return (
    <details className="mb-5 border-y border-line-soft py-3">
      <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-2 text-[12px] text-ink-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
        <span className="font-semibold text-ink-2">来源覆盖 <span className="num ml-1 text-accent">{totals.configured}</span></span>
        <span>正常 {totals.ok + totals.noUpdate} · 待采集 {totals.neverCollected} · 异常 {totals.failed + totals.stale} · 暂停 {totals.paused} · 待复核 {totals.pendingReview}</span>
      </summary>
      <p className="mt-3 text-[12px] leading-relaxed text-ink-4">采集成功表示已读取来源，公开动态仍需复核。无新增与采集失败分别记录；回溯窗口受限的来源会标明截断。</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-left text-[12px] leading-relaxed">
          <caption className="sr-only">政策来源采集状态、最近成功时间与官方最新发布日期</caption>
          <thead><tr className="border-b border-line text-ink-4"><th className="px-2 py-2 font-normal">来源</th><th className="px-2 py-2 font-normal">状态</th><th className="px-2 py-2 font-normal">最近成功</th><th className="px-2 py-2 font-normal">官方最新发布</th><th className="px-2 py-2 font-normal">公开 / 待复核</th></tr></thead>
          <tbody>{data.sources.map(source => {
            const href = source.url && publicEvidenceUrl(source.url);
            return <tr key={source.id} className="border-b border-line-soft align-top last:border-0">
              <td className="max-w-[200px] px-2 py-3">{href ? <a href={href} target="_blank" rel="noopener noreferrer" className="text-ink-2 hover:text-accent">{source.name}</a> : <span className="text-ink-2">{source.name}</span>}<div className="mt-1 text-[11px] text-ink-4">每 {source.intervalMinutes} 分钟</div></td>
              <td className="max-w-[220px] px-2 py-3"><span className={source.state === "failed" || source.state === "stale" ? "text-amber-ink" : "text-ink-3"}>{STATE_LABELS[source.state]}</span>{source.failureReason && source.state === "failed" && <p className="mt-1 text-[11px] text-ink-4">{source.failureReason}</p>}{source.state === "failed" && source.lastFailureAt && <p className="mt-1 text-[11px] text-ink-4">失败于 {date(source.lastFailureAt)}</p>}{source.lastRun?.truncated && <p className="mt-1 text-[11px] text-amber-ink">回溯窗口截断，需补查</p>}{source.lastRun && <><p className="mt-1 text-[11px] text-ink-4">{source.lastRun.pages} 页 · 新增 {source.lastRun.new} · 修订 {source.lastRun.revised}</p>{(source.lastRun.windowFrom || source.lastRun.windowTo) && <p className="mt-1 text-[11px] text-ink-4">本次窗口 {source.lastRun.windowFrom?.slice(0, 10) ?? "—"} 至 {source.lastRun.windowTo?.slice(0, 10) ?? "—"}</p>}</>}</td>
              <td className="mono px-2 py-3 text-ink-3">{date(source.lastSuccessAt)}</td><td className="mono px-2 py-3 text-ink-3">{date(source.latestPublishedAt)}</td><td className="num px-2 py-3 text-ink-3">{source.publishedCount} / {source.pendingReviewCount}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      {data.limitations.length > 0 && <details className="mt-3"><summary className="cursor-pointer text-[12px] text-ink-4">接入限制与待补来源（{data.limitations.length}）</summary><ul className="mt-2 space-y-2 text-[12px] leading-relaxed text-ink-3">{data.limitations.map(source => <li key={source.id}><span className="font-medium text-ink-2">{source.name}</span>：{source.reason}</li>)}</ul></details>}
      <p className="mt-3 text-[11px] text-ink-4">状态更新于 <time dateTime={data.generatedAt}>{date(data.generatedAt)}</time></p>
    </details>
  );
}
