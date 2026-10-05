// HERO: the policy's dates, legal effect and evidence stay next to the facts they qualify.
import { Link } from "react-router";
import type { PolicyFacts } from "@aihot/contracts/site";
import { publicEvidenceUrl } from "../../lib/policy-filters";
import { IconExternal } from "../../components/icons";

export function PolicyStatus({ policy }: { policy: PolicyFacts }) {
  const statuses = [
    ["阶段", policy.stage],
    ["效力", policy.legalStatus],
    ["执行", policy.implementationStatus],
  ].filter((entry): entry is [string, string] => !!entry[1]);
  if (!statuses.length && !policy.effectiveAt && !policy.deadlines.length) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] leading-relaxed text-ink-3">
      {statuses.map(([label, value]) => <span key={label}><span className="text-ink-4">{label} · </span><span className={label === "效力" ? "font-semibold text-accent" : "text-ink-2"}>{value}</span></span>)}
      {policy.legalStatusAsOf && <span>效力核对 <time className="mono" dateTime={policy.legalStatusAsOf}>{policy.legalStatusAsOf}</time></span>}
      {policy.effectiveAt && <span>生效 <time className="mono text-ink-2" dateTime={policy.effectiveAt}>{policy.effectiveAt}</time></span>}
      {policy.deadlines.map(deadline => <span key={`${deadline.label}-${deadline.date}`}>{deadline.label} <time className="mono text-ink-2" dateTime={deadline.date}>{deadline.date}</time></span>)}
    </div>
  );
}

function EvidenceLink({ title, url, articleId }: { title: string; url: string; articleId?: string }) {
  if (articleId) return <Link to={`/items/${encodeURIComponent(articleId)}`} className="text-accent hover:underline">{title}</Link>;
  const href = publicEvidenceUrl(url);
  return href ? <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-baseline gap-1 text-accent hover:underline">{title}<IconExternal size={12} className="shrink-0 self-center" /></a> : <span>{title}</span>;
}

export function PolicyFactsCard({ policy }: { policy: PolicyFacts }) {
  const fields = [
    ["文号", policy.documentNumber],
    ["发布机关", policy.issuers.join("、")],
    ["文件类型", policy.documentType],
    ["适用地域", policy.region],
    ["成文日期", policy.issuedAt],
    ["生效日期", policy.effectiveAt],
    ["适用对象", policy.scope],
  ].filter((entry): entry is [string, string] => !!entry[1]);
  return (
    <section aria-labelledby="policy-facts" className="mt-7 border-t-2 border-ink pt-4">
      <h2 id="policy-facts" className="text-[17px] font-bold text-ink">政策事实</h2>
      <PolicyStatus policy={policy} />
      {fields.length > 0 && <dl className="mt-4 grid gap-x-5 gap-y-3 text-[13px] leading-[1.7] sm:grid-cols-2">
        {fields.map(([label, value]) => <div key={label} className={label === "适用对象" ? "sm:col-span-2" : ""}><dt className="text-[12px] text-ink-4">{label}</dt><dd className="mt-0.5 text-ink-2">{value}</dd></div>)}
      </dl>}
      {policy.keyPoints.length > 0 && <div className="mt-5"><h3 className="text-[13px] font-semibold text-ink">关键规定</h3><ul className="mt-2 list-disc space-y-2 pl-4 text-[14px] leading-[1.75] text-ink-2">{policy.keyPoints.map(point => <li key={point}>{point}</li>)}</ul></div>}
      {policy.attachments.length > 0 && <div className="mt-5"><h3 className="text-[13px] font-semibold text-ink">原文附件</h3><ul className="mt-2 space-y-2 text-[13px] leading-relaxed">{policy.attachments.map(attachment => <li key={attachment.url}><EvidenceLink {...attachment} /></li>)}</ul></div>}
    </section>
  );
}

export function PolicyEvidence({ policy }: { policy: PolicyFacts }) {
  if (!policy.relations.length && !policy.changeNotes.length && !policy.evidenceNotes.length) return null;
  return (
    <section aria-labelledby="policy-evidence" className="mt-7 border-t border-line pt-4">
      <h2 id="policy-evidence" className="text-[17px] font-bold text-ink">版本与执行证据</h2>
      {policy.changeNotes.length > 0 && <div className="mt-4"><h3 className="text-[13px] font-semibold text-ink">已核对的变化</h3><ul className="mt-2 list-disc space-y-2 pl-4 text-[14px] leading-[1.75] text-ink-2">{policy.changeNotes.map(note => <li key={note}>{note}</li>)}</ul></div>}
      {policy.relations.length > 0 && <ol className="mt-4 border-l border-line">
        {policy.relations.map((relation, index) => <li key={`${relation.kind}-${relation.url}-${index}`} className="relative pl-4 pb-4 last:pb-0"><span className="absolute -left-[3px] top-1.5 size-[5px] rounded-full bg-accent" /><span className="mb-1 block text-[11.5px] text-ink-4">{relation.kind}</span><div className="text-[13.5px] leading-relaxed"><EvidenceLink {...relation} /></div></li>)}
      </ol>}
      {policy.evidenceNotes.length > 0 && <div className="mt-5 bg-bg-sunk px-4 py-3"><h3 className="text-[12px] font-semibold text-ink-3">核对记录与待确认事项</h3><ul className="mt-2 space-y-2 text-[13px] leading-[1.75] text-ink-3">{policy.evidenceNotes.map(note => <li key={note}>{note}</li>)}</ul></div>}
    </section>
  );
}
