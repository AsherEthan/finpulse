import { data, Form, Link, useNavigate, useSearchParams } from "react-router";
import type { SourceCatalogResponse } from "@aihot/contracts/sources";
import type { Route } from "./+types/sources";
import { IconArrowLeft, IconChevronRight, IconSearch } from "../components/icons";
import { EmptyState } from "../components/ui/Page";
import { buttonClass } from "../components/ui/Controls";
import { Pagination } from "../features/feed/DayList";
import { loadOr404 } from "../lib/api.server";
import { fullDateTime } from "../lib/format";
import { SOURCE_DIMENSION_LABELS } from "../lib/information-labels";
import { filterSourceCatalog, sourceCatalogFilters, sourceCatalogHref, SOURCE_STATE_LABELS } from "../lib/source-catalog";
import { pageMeta } from "../lib/seo";

const PAGE_SIZE = 20;

export async function loader({ request }: Route.LoaderArgs) {
  const catalog = await loadOr404<SourceCatalogResponse>("/api/site/sources", { signal: request.signal });
  const filters = sourceCatalogFilters(new URL(request.url).searchParams);
  const matching = filterSourceCatalog(catalog.sources, filters);
  const pageCount = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  return data({
    generatedAt: catalog.generatedAt,
    sources: matching.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    filters, page, pageCount, matching: matching.length,
    tags: [...new Set(catalog.sources.flatMap(source => source.tags))].sort((a, b) => a.localeCompare(b, "zh-CN")),
    totals: {
      total: catalog.sources.length,
      enabled: catalog.sources.filter(source => source.enabled).length,
      paused: catalog.sources.filter(source => !source.enabled).length,
      failed: catalog.sources.filter(source => source.state === "failed" || source.state === "stale").length,
    },
  }, { headers: { "Cache-Control": "public, max-age=0, s-maxage=30" } });
}

export function headers({ loaderHeaders }: Route.HeadersArgs) { return loaderHeaders; }

export function meta() {
  return pageMeta({ title: "信息源", description: "查看本站跟踪的来源、标签和采集状态，并管理来源设置。", path: "/sources", noindex: true });
}

export default function SourcesPage({ loaderData }: Route.ComponentProps) {
  const { sources, filters, tags, totals, page, pageCount, matching, generatedAt } = loaderData;
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const setFilter = (key: string, value: string) => navigate(sourceCatalogHref(params, { [key]: value }), { preventScrollReset: true });
  const control = "h-10 w-full min-w-0 rounded-control border border-line-strong bg-surface px-3 text-[13px] text-ink outline-none focus:border-accent";
  const filtered = !!(filters.q || filters.sourceType || filters.state || filters.enabled || filters.tag);
  return (
    <div className="mx-auto max-w-[var(--page-max-reading)] pb-8">
      <header className="pb-5 pt-5 lg:pt-1">
        <Link to="/more" className="mb-3 inline-flex items-center gap-1 text-[12px] text-ink-4 hover:text-ink-2"><IconArrowLeft size={14} /> 更多</Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-[24px] font-semibold text-ink">信息源</h1>
          <Link to="/admin/sources" className={buttonClass("secondary")}>管理信源 <IconChevronRight size={14} /></Link>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-3">查看本站跟踪的来源、标签与采集状态。编辑来源设置需要管理员身份。</p>
      </header>

      <dl className="mb-5 grid grid-cols-4 gap-2 sm:gap-3">
        {[["全部来源", totals.total], ["已启用", totals.enabled], ["已暂停", totals.paused], ["需检查", totals.failed]].map(([label, count]) => (
          <div key={label} className="card px-3 py-3 sm:px-4"><dt className="text-[11px] text-ink-4 sm:text-[12px]">{label}</dt><dd className="num mt-1 text-[22px] font-semibold text-ink">{count}</dd></div>
        ))}
      </dl>

      <section aria-label="筛选信息源" className="card mb-4 p-3 sm:p-4">
        <Form method="get" className="flex gap-2" key={filters.q}>
          {["sourceType", "state", "enabled", "tag"].map(key => params.get(key) && <input key={key} type="hidden" name={key} value={params.get(key)!} />)}
          <label className="relative min-w-0 flex-1"><span className="sr-only">搜索信息源</span><IconSearch size={16} className="absolute left-3 top-3 text-ink-4" /><input name="q" defaultValue={filters.q} placeholder="搜索名称、地址或标签…" className={`${control} pl-9`} /></label>
          <button type="submit" className={buttonClass("primary")}>搜索</button>
        </Form>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <label className="min-w-0 text-[12px] text-ink-4">来源类型<select className={`${control} mt-1`} value={filters.sourceType ?? ""} onChange={e => setFilter("sourceType", e.target.value)}><option value="">全部类型</option>{Object.entries(SOURCE_DIMENSION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="min-w-0 text-[12px] text-ink-4">启用状态<select className={`${control} mt-1`} value={filters.enabled ?? ""} onChange={e => setFilter("enabled", e.target.value)}><option value="">全部状态</option><option value="true">已启用</option><option value="false">已暂停</option></select></label>
          <label className="min-w-0 text-[12px] text-ink-4">采集状态<select className={`${control} mt-1`} value={filters.state ?? ""} onChange={e => setFilter("state", e.target.value)}><option value="">全部状态</option>{Object.entries(SOURCE_STATE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="min-w-0 text-[12px] text-ink-4">标签<select className={`${control} mt-1`} value={filters.tag ?? ""} onChange={e => setFilter("tag", e.target.value)}><option value="">全部标签</option>{filters.tag && !tags.includes(filters.tag) && <option value={filters.tag}>{filters.tag}</option>}{tags.map(tag => <option key={tag} value={tag}>{tag}</option>)}</select></label>
        </div>
        {filtered && <Link to="/sources" className="mt-3 inline-block text-[12px] text-accent hover:text-accent-ink">清除筛选</Link>}
      </section>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-1 text-[12px] text-ink-4"><span>显示 <span className="num">{matching}</span> 个来源{pageCount > 1 && ` · 第 ${page} / ${pageCount} 页`}</span><span>状态更新于 <time dateTime={generatedAt}>{fullDateTime(generatedAt)}</time></span></div>
      {sources.length === 0 ? <div className="card"><EmptyState title="没有匹配的信息源" action={<Link to="/sources" className={buttonClass("secondary")}>查看全部来源</Link>}>试试其他名称、标签或状态。</EmptyState></div> : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {sources.map(source => (
            <li key={source.id} className="card flex min-w-0 flex-col p-4">
              <div className="flex items-start justify-between gap-3">
                <h2 className="min-w-0 text-[15px] font-semibold leading-relaxed text-ink">{source.name}</h2>
                <Link to={`/admin/sources/${encodeURIComponent(source.id)}`} aria-label={`编辑${source.name}`} className="shrink-0 rounded-full bg-accent-soft px-3 py-1 text-[12px] font-medium text-accent hover:bg-bg-sunk">编辑</Link>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-ink-3"><span className="rounded bg-bg-sunk px-2 py-0.5">{SOURCE_DIMENSION_LABELS[source.sourceDimension]}</span>{source.firstParty && <span className="rounded bg-accent-soft px-2 py-0.5 text-accent">一手</span>}<span className="rounded bg-bg-sunk px-2 py-0.5">{source.enabled ? "已启用" : "已暂停"}</span></div>
              {source.url && <a href={source.url} target="_blank" rel="noopener noreferrer" className="mt-2 truncate text-[12px] text-ink-4 hover:text-accent" title={source.url}>{source.url}</a>}
              {source.tags.length > 0 && <div className="mt-3 flex flex-wrap gap-x-2 gap-y-1">{source.tags.map(tag => <Link key={tag} to={sourceCatalogHref(params, { tag: filters.tag === tag ? null : tag })} className={`text-[11.5px] ${filters.tag === tag ? "font-medium text-accent" : "text-ink-3 hover:text-accent"}`}>#{tag}</Link>)}</div>}
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line-soft pt-3 text-[12px] text-ink-3"><span className={source.state === "failed" || source.state === "stale" ? "text-amber-ink" : ""}>{SOURCE_STATE_LABELS[source.state]}</span><span>每 {source.intervalMinutes} 分钟检查</span><span>已公开 <span className="num">{source.publishedCount}</span> 条</span></div>
              <div className="mt-1 text-[11px] text-ink-4">最近成功：{source.lastSuccessAt ? <time dateTime={source.lastSuccessAt}>{fullDateTime(source.lastSuccessAt)}</time> : "尚无成功记录"}</div>
            </li>
          ))}
        </ul>
      )}
      <Pagination page={page} pageCount={pageCount} href={page => sourceCatalogHref(params, { page })} />
    </div>
  );
}
