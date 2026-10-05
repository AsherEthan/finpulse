// Feed filters: the channel and category row, and search.
import { useEffect, useRef, useState } from "react";
import { Form, Link, useNavigate, useNavigation, useSearchParams } from "react-router";
import { CAPITAL_FLOW_TAG_GROUPS, CAPITAL_FLOW_TOPICS, DISCLOSURE_TOPICS, ECONOMICS_TOPICS, POLICY_TAG_GROUPS, POLICY_TOPICS, SUPPLY_CHAIN_TAG_GROUPS, SUPPLY_CHAIN_TOPICS } from "@aihot/industry/taxonomy";
import { CATEGORY_KEYS, CATEGORY_LABELS, type CategoryKey, type ChannelKey } from "@aihot/contracts/taxonomy";
import { IconClose, IconSearch } from "../../components/icons";
import { PillTabs } from "../../components/ui/Tabs";
import { policyFilterValues, togglePolicyFilter, type PolicyFilterKey } from "../../lib/policy-filters";
import { categoryHref, firstPartyHref, hrefWith } from "../../lib/feed-filters";
import type { PolicyFacets } from "@aihot/contracts/site";
import { CONTENT_NATURE_LABELS, informationFiltersFromParams, SOURCE_DIMENSION_LABELS, VERIFICATION_LABELS } from "../../lib/information-labels";
import { paperTopicHref } from "../../lib/paper-filters";
import { disclosureTopicHref, disclosureTopicName } from "../../lib/disclosure-filters";

/** These describe the evidence independently of the financial column. */
export function InformationFilters() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const filters = informationFiltersFromParams(params);
  const dimensions = [
    { key: "sourceType", label: "来源类型", values: SOURCE_DIMENSION_LABELS },
    { key: "nature", label: "内容性质", values: CONTENT_NATURE_LABELS },
    { key: "verification", label: "原文核验", values: VERIFICATION_LABELS },
  ] as const;
  return <div className="mb-5 mt-4 space-y-2 lg:mt-0">
    <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:gap-4">
      {dimensions.map(({ key, label, values }) => <label key={key} className="flex min-w-0 flex-col items-stretch gap-1 text-[12.5px] text-ink-3 sm:flex-row sm:items-center sm:gap-2">
        <span className="shrink-0">{label}</span>
        <select aria-label={label} value={filters[key] ?? ""} onChange={event => navigate(hrefWith("/all", params, { [key]: event.target.value || null }), { preventScrollReset: true })} className="h-9 min-w-0 flex-1 rounded-control border border-line-strong bg-surface px-1.5 text-ink outline-offset-2 sm:flex-none sm:px-2">
          <option value="">全部</option>
          {Object.entries(values).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
        </select>
      </label>)}
    </div>
    <p className="text-[11.5px] leading-relaxed text-ink-4">来源类型与一手属性分别标记；核对原文表示摘要忠实于原文，估算和观点仍按其性质阅读。</p>
    {Object.values(filters).some(Boolean) && <Link to={hrefWith("/all", params, { sourceType: null, nature: null, verification: null })} className="inline-block text-[12px] text-accent hover:underline">清除来源与核验筛选</Link>}
  </div>;
}

/**
 * Both feeds combine one main column with an independent first-party source filter.
 * Older 资讯 / X links still filter; the row then shows 全部.
 */
export function CategoryTabs({ base, category, channel = "all", layoutId, size = "md", className = "" }: { base: string; category: CategoryKey | null; channel?: ChannelKey; layoutId: string; size?: "md" | "sm"; className?: string }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const items = [
    { key: "all", label: "全部", to: categoryHref(base, params, null) },
    ...CATEGORY_KEYS.map((k) => ({ key: k, label: CATEGORY_LABELS[k], to: categoryHref(base, params, k) })),
  ];
  return <div className={`flex min-w-0 flex-wrap items-center gap-2 ${className}`}>
    <PillTabs items={items} active={category ?? "all"} layoutId={layoutId} label="主栏目" size={size} className="min-w-0" />
    <label className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 ${size === "sm" ? "h-8 text-[12px]" : "h-9 text-[13px]"} ${channel === "firstParty" ? "border-accent bg-accent-soft text-accent" : "border-line-strong text-ink-3 hover:text-ink"}`}>
      <input type="checkbox" checked={channel === "firstParty"} onChange={() => navigate(firstPartyHref(base, params), { preventScrollReset: true })} className="size-3.5 accent-[var(--accent)]" />
      仅一手来源
    </label>
  </div>;
}

export function PolicyFilters({ topic, tag, facets }: { topic: string | null; tag: string | null; facets?: PolicyFacets }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const items = [
    { key: "all", label: "全部政策", to: hrefWith("/all", params, { topic: null, category: "policy" }) },
    ...POLICY_TOPICS.map(t => ({ key: t.slug, label: t.name, to: hrefWith("/all", params, { topic: t.slug, category: "policy" }) })),
  ];
  const knownTag = POLICY_TAG_GROUPS.some(g => (g.tags as readonly string[]).includes(tag ?? ""));
  const dimensions: Array<{ key: PolicyFilterKey; label: string; values: string[] }> = [
    { key: "issuer", label: "发布机关", values: facets?.issuers ?? [] },
    { key: "region", label: "地域", values: facets?.regions ?? [] },
    { key: "stage", label: "发布阶段", values: facets?.stages ?? [] },
    { key: "documentType", label: "文件类型", values: facets?.documentTypes ?? [] },
  ];
  return (
    <div className="space-y-3">
      <PillTabs items={items} active={topic ?? "all"} layoutId="all-policy-topics" label="政策主题" size="sm" />
      <div className="flex flex-wrap items-start gap-2">
        {dimensions.map(({ key, label, values }) => {
          const selected = policyFilterValues(params, key);
          const options = [...new Set([...values, ...selected])];
          return <details key={key} className="group relative min-w-[110px] flex-1 sm:flex-none">
            <summary className="flex h-9 cursor-pointer list-none items-center justify-between gap-3 rounded-control border border-line-strong bg-surface px-3 text-[12.5px] text-ink-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
              <span>{label}{selected.length > 0 && <span className="ml-1.5 num font-semibold text-accent">{selected.length}</span>}</span><span aria-hidden="true" className="text-[10px] transition-transform group-open:rotate-180">⌄</span>
            </summary>
            <fieldset className="relative z-20 mt-1 min-w-[180px] border border-line-strong bg-surface p-2 sm:absolute sm:shadow-[var(--shadow-pop)]">
              <legend className="sr-only">{label}（可多选）</legend>
              {options.length ? options.map(value => <label key={value} className="flex cursor-pointer items-center gap-2 px-1.5 py-2 text-[12.5px] leading-snug text-ink-2 hover:bg-bg-sunk"><input type="checkbox" checked={selected.includes(value)} onChange={() => navigate(togglePolicyFilter(params, key, value))} className="size-3.5 accent-[var(--accent)]" />{value}</label>) : <p className="px-1.5 py-2 text-[12px] text-ink-4">尚无已核对资料</p>}
            </fieldset>
          </details>;
        })}
      </div>
      {dimensions.some(({ key }) => policyFilterValues(params, key).length > 0) && <div className="flex flex-wrap items-center gap-1.5">
        {dimensions.flatMap(({ key, label }) => policyFilterValues(params, key).map(value => <Link key={`${key}-${value}`} to={togglePolicyFilter(params, key, value)} className="chip inline-flex items-center gap-1.5" aria-label={`移除${label}：${value}`}>{value}<IconClose size={11} /></Link>))}
        <Link to={hrefWith("/all", params, { issuer: null, region: null, stage: null, documentType: null, tag: null })} className="ml-1 text-[12px] text-ink-4 hover:text-accent">清除条件</Link>
      </div>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-[13px] text-ink-3">
          资料标签
          <select value={tag ?? ""} onChange={e => navigate(hrefWith("/all", params, { tag: e.target.value || null, category: "policy" }))} className="h-9 max-w-[190px] rounded-lg border border-line-strong bg-surface px-3 text-ink outline-offset-2">
            <option value="">全部标签</option>
            {tag && !knownTag && <option value={tag}>{tag}</option>}
            {POLICY_TAG_GROUPS.map(g => <optgroup key={g.name} label={g.name}>{g.tags.map(t => <option key={t} value={t}>{t}</option>)}</optgroup>)}
          </select>
        </label>
        <span className="text-[11.5px] text-ink-4">同项多选取并集，不同条件同时满足</span>
      </div>
    </div>
  );
}

export function SupplyChainFilters({ topic, tag }: { topic: string | null; tag: string | null }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const items = [
    { key: "all", label: "全部产业链", to: hrefWith("/all", params, { topic: null, category: "supply-chain" }) },
    ...SUPPLY_CHAIN_TOPICS.map(t => ({ key: t.slug, label: t.name, to: hrefWith("/all", params, { topic: t.slug, category: "supply-chain" }) })),
  ];
  const knownTag = SUPPLY_CHAIN_TAG_GROUPS.some(g => (g.tags as readonly string[]).includes(tag ?? ""));
  return <div className="space-y-3">
    <PillTabs items={items} active={topic ?? "all"} layoutId="all-chain-topics" label="产业链主题" size="sm" />
    <label className="flex items-center gap-2 text-[13px] text-ink-3">
      资料标签
      <select value={tag ?? ""} onChange={e => navigate(hrefWith("/all", params, { tag: e.target.value || null, category: "supply-chain" }))} className="h-9 max-w-[230px] rounded-lg border border-line-strong bg-surface px-3 text-ink outline-offset-2">
        <option value="">全部标签</option>
        {tag && !knownTag && <option value={tag}>{tag}</option>}
        {SUPPLY_CHAIN_TAG_GROUPS.map(g => <optgroup key={g.name} label={g.name}>{g.tags.map(t => <option key={t} value={t}>{t}</option>)}</optgroup>)}
      </select>
    </label>
  </div>;
}

export function CapitalFlowFilters({ topic, tag }: { topic: string | null; tag: string | null }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const items = [
    { key: "all", label: "全部资金流", to: hrefWith("/all", params, { topic: null, category: "capital-flow" }) },
    ...CAPITAL_FLOW_TOPICS.map(t => ({ key: t.slug, label: t.name, to: hrefWith("/all", params, { topic: t.slug, category: "capital-flow" }) })),
  ];
  const knownTag = CAPITAL_FLOW_TAG_GROUPS.some(g => (g.tags as readonly string[]).includes(tag ?? ""));
  return <div className="space-y-3">
    <PillTabs items={items} active={topic ?? "all"} layoutId="all-capital-topics" label="资金主题" size="sm" />
    <label className="flex items-center gap-2 text-[13px] text-ink-3">
      资料标签
      <select value={tag ?? ""} onChange={e => navigate(hrefWith("/all", params, { tag: e.target.value || null, category: "capital-flow" }))} className="h-9 max-w-[230px] rounded-lg border border-line-strong bg-surface px-3 text-ink outline-offset-2">
        <option value="">全部标签</option>
        {tag && !knownTag && <option value={tag}>{tag}</option>}
        {CAPITAL_FLOW_TAG_GROUPS.map(g => <optgroup key={g.name} label={g.name}>{g.tags.map(t => <option key={t} value={t}>{t}</option>)}</optgroup>)}
      </select>
    </label>
  </div>;
}

export function DisclosureFilters({ topic }: { topic: string | null }) {
  const [params] = useSearchParams();
  const items = [
    { key: "all", label: "全部披露与数据", to: disclosureTopicHref(params, null) },
    ...DISCLOSURE_TOPICS.map(t => ({ key: t.slug, label: t.name, to: disclosureTopicHref(params, t.slug) })),
  ];
  return <div className="space-y-2">
    <PillTabs items={items} active={disclosureTopicName(topic) ? topic! : "all"} layoutId="all-disclosure-topics" label="披露与数据主题" size="sm" />
    <p className="text-[11.5px] leading-relaxed text-ink-4">按披露事项与统计主题浏览；发布日期、报告周期和数据口径分别核对。</p>
  </div>;
}

export function PapersFilters({ topic }: { topic: string | null }) {
  const [params] = useSearchParams();
  const items = [
    { key: "all", label: "全部论文", to: paperTopicHref(params, null) },
    ...ECONOMICS_TOPICS.map(t => ({ key: t.slug, label: t.name, to: paperTopicHref(params, t.slug) })),
  ];
  return <div className="space-y-2">
    <PillTabs items={items} active={topic === "papers" ? "all" : topic ?? "all"} layoutId="all-paper-topics" label="经济学论文主题" size="sm" />
    <p className="text-[11.5px] leading-relaxed text-ink-4">按研究问题浏览；工作论文的结论可能随修订变化，模型估计与现实数据分别标记。</p>
  </div>;
}

function useSlashFocus(ref: React.RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement)?.isContentEditable)) {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ref]);
}

/**
 * Search field (GET /all?q=…). Desktop ("track"): at the end of the filter row as the same grey track,
 * at the height of md tabs, with a "/" hint. Phones ("bar"): full width with a separate 搜索 button.
 */
export function SearchField({ action = "/all", defaultValue = "", keep = {}, variant = "track", autoFocus = false }: { action?: string; defaultValue?: string; keep?: Record<string, string | string[] | null>; variant?: "track" | "bar"; autoFocus?: boolean }) {
  const [value, setValue] = useState(defaultValue);
  const navigation = useNavigation();
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => setValue(defaultValue), [defaultValue]);
  useSlashFocus(inputRef);
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);
  const searching = navigation.state === "loading" && navigation.location?.pathname === action && !!new URLSearchParams(navigation.location.search).get("q");
  const hidden = Object.entries(keep).flatMap(([k, v]) => (Array.isArray(v) ? v : [v]).filter(Boolean).map((value, index) => <input key={`${k}-${index}`} type="hidden" name={k} value={value!} />));

  if (variant === "bar") {
    return (
      <Form method="get" action={action} role="search" className="flex gap-2">
        {hidden}
        <label className="relative flex-1">
          <span className="sr-only">搜索标题、摘要与正文</span>
          <IconSearch size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-4" />
          <input
            ref={inputRef}
            name="q"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="搜索标题、摘要…"
            maxLength={200}
            autoComplete="off"
            enterKeyHint="search"
            className="h-11 w-full rounded-full border border-line-strong bg-surface pl-10 pr-9 text-[15px] text-ink outline-none transition-[border-color,box-shadow] placeholder:text-ink-4 focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)]"
          />
          {value && (
            <button type="button" aria-label="清空" onClick={() => { setValue(""); inputRef.current?.focus(); }} className="absolute right-2.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-ink-4">
              <IconClose size={15} />
            </button>
          )}
        </label>
        <button type="submit" className={`h-11 shrink-0 rounded-full bg-accent px-5 text-[14.5px] font-semibold text-accent-contrast transition-[background-color,transform] active:scale-[0.98] ${searching ? "opacity-60" : ""}`}>
          搜索
        </button>
      </Form>
    );
  }

  return (
    <Form method="get" action={action} role="search" className="group relative w-full shrink-0 lg:w-60">
      {hidden}
      <label htmlFor="site-search" className="sr-only">
        搜索标题、摘要与正文
      </label>
      <IconSearch size={16} className={`pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${searching ? "text-accent" : "text-ink-4 group-focus-within:text-ink-3"}`} />
      <input
        ref={inputRef}
        id="site-search"
        name="q"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="搜索标题、摘要…"
        maxLength={200}
        autoComplete="off"
        className="h-[42px] w-full rounded-full bg-bg-sunk pl-10 pr-10 text-[14px] text-ink outline-none ring-1 ring-inset ring-line-soft transition-[background-color,box-shadow] placeholder:text-ink-4 hover:ring-line-strong focus:bg-surface focus:shadow-[0_0_0_3px_var(--accent-soft)] focus:ring-accent dark:bg-bg-muted/60 dark:focus:bg-surface"
      />
      {value ? (
        <button
          type="button"
          aria-label="清空"
          onClick={() => {
            setValue("");
            inputRef.current?.focus();
          }}
          className="absolute right-3 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-ink-4 transition-colors hover:bg-bg-sunk hover:text-ink"
        >
          <IconClose size={13} />
        </button>
      ) : (
        <kbd className="mono pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 rounded-mark border border-line-strong bg-surface px-1.5 text-[10.5px] leading-4 text-ink-4 lg:block">/</kbd>
      )}
    </Form>
  );
}

/** Mobile home: the search icon at the end of the category row opens search on 全部动态. */
export function SearchIconLink() {
  const [params] = useSearchParams();
  return (
    <Link to={hrefWith("/all", params, { search: "1" })} aria-label="搜索" className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-bg-sunk hover:text-ink">
      <IconSearch size={19} />
    </Link>
  );
}
