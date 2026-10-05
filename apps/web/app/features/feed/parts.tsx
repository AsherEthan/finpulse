// Small building blocks shared by feed items, detail pages and lists.
import { useState } from "react";
import type { FeedItemSummary, InformationProfile, MediaView, SourceRef } from "@aihot/contracts/site";
import { IconBookmark } from "../../components/icons";
import { SourceAvatar } from "../../components/ui/SourceAvatar";
import { Badge } from "../../components/ui/Badge";
import { Lightbox } from "../../components/ui/Lightbox";
import { toggleStar, useIsStarred } from "../../lib/local-state";
import { CONTENT_NATURE_LABELS, SOURCE_DIMENSION_LABELS, VERIFICATION_LABELS } from "../../lib/information-labels";

export function FirstPartyBadge() {
  return <Badge tone="accent" title="来源标记为发布机构或当事方">一手</Badge>;
}

export function SourceDimensionBadge({ source }: { source: Partial<Pick<SourceRef, "sourceDimension">> }) {
  const dimension = source.sourceDimension;
  return dimension && dimension !== "original" ? <Badge title="来源类型独立于一手属性与内容性质">{SOURCE_DIMENSION_LABELS[dimension]}</Badge> : null;
}

/** The publisher's identity and first-party source attribute, also for official X accounts. */
export function SourceLine({ item, avatarSize = 16, className = "" }: { item: Pick<FeedItemSummary, "x" | "channel"> & { source: Pick<SourceRef, "name"> & Partial<Pick<SourceRef, "firstParty" | "sourceDimension">> }; avatarSize?: number; className?: string }) {
  const dimensionBadge = <SourceDimensionBadge source={item.source} />;
  if (item.channel === "x" && item.x) {
    return (
      <span className={`flex min-w-0 items-center gap-1.5 ${className}`}>
        <SourceAvatar name={item.x.authorName} avatarUrl={item.x.avatarUrl} avatarSrcSet={item.x.avatarSrcSet} size={avatarSize} />
        <span className="truncate text-ink-3">{item.x.authorName}</span>
        <span className="hidden shrink-0 text-ink-4 min-[400px]:inline">@{item.x.handle}</span>
        {item.source.firstParty && <FirstPartyBadge />}
        {dimensionBadge}
      </span>
    );
  }
  return <span className={`flex min-w-0 items-center gap-1.5 ${className}`}><span className="truncate" title={item.source.name}>{item.source.name}</span>{item.source.firstParty && <FirstPartyBadge />}{dimensionBadge}</span>;
}

export function InformationProfileLine({ profile }: { profile: InformationProfile }) {
  const checkedAt = profile.checkedAt ? `于${new Date(profile.checkedAt).toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" })}` : "";
  return <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-ink-4">
    <span className="rounded-mark bg-bg-sunk px-2 py-0.5">{CONTENT_NATURE_LABELS[profile.contentNature]}</span>
    <span title={profile.verificationStatus === "original_checked" ? `${checkedAt}核对本站摘要与所读版本原文；原文中的估算与观点不因此成为事实` : "尚未核对当前版本原文"} className="rounded-mark bg-bg-sunk px-2 py-0.5">{VERIFICATION_LABELS[profile.verificationStatus]}</span>
  </div>;
}

/** Up to four media thumbnails, kept small in lists (the detail page shows them larger). Videos are stills. */
export function MediaThumbs({ media, className = "" }: { media: MediaView[]; className?: string }) {
  const [index, setIndex] = useState<number | null>(null);
  const images = media.filter((m) => m.kind === "image").map((m) => ({ src: m.fullUrl ?? m.url, alt: m.alt }));
  const shown = media.slice(0, 4);
  if (shown.length === 0) return null;
  return (
    <>
    <div className={`flex gap-1.5 overflow-hidden ${className}`}>
      {shown.map((m) => {
        const Wrapper = m.kind === "image" ? "button" : "span";
        return (
        <Wrapper key={m.url} {...(m.kind === "image" ? { type: "button" as const, "aria-label": `查看图片${m.alt ? `：${m.alt}` : ""}`, onClick: (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); setIndex(images.findIndex((image) => image.src === (m.fullUrl ?? m.url))); } } : {})} className={`relative ${m.kind === "image" ? "z-10 cursor-zoom-in" : ""} shrink-0 overflow-hidden rounded-control border border-line-soft bg-bg-sunk ${shown.length === 1 ? "max-w-[240px]" : "w-[112px]"}`}>
          <img src={m.poster ?? m.url} srcSet={m.srcSet} sizes={shown.length === 1 ? `${m.width && m.height ? Math.min(240, Math.ceil(112 * m.width / m.height)) : 240}px` : "112px"} width={m.width ?? undefined} height={m.height ?? undefined} alt={m.alt ?? ""} loading="lazy" decoding="async" className={`h-[112px] object-cover ${shown.length === 1 ? "w-auto max-w-[240px]" : "w-[112px]"}`} />
          {m.kind === "video" && (
            <span className="absolute inset-0 grid place-items-center" aria-hidden="true">
              <span className="grid size-8 place-items-center rounded-full bg-black/55 text-white">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="ml-px">
                  <path d="M7 4.5v15a1 1 0 001.5.87l13-7.5a1 1 0 000-1.74l-13-7.5A1 1 0 007 4.5z" />
                </svg>
              </span>
            </span>
          )}
        </Wrapper>
      ); })}
    </div>
    <Lightbox images={images} index={index} onIndex={setIndex} onClose={() => setIndex(null)} />
    </>
  );
}

/** Bookmark toggle kept in this browser (收藏). */
export function StarButton({ item, size = 26, className = "" }: { item: Pick<FeedItemSummary, "id" | "title" | "summary" | "source" | "publishedAt" | "score" | "selected">; size?: number; className?: string }) {
  const starred = useIsStarred(item.id);
  const [pulse, setPulse] = useState(0);
  const on = starred;
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? "取消收藏" : "收藏"}
      title={on ? "取消收藏" : "收藏"}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const added = await toggleStar({
          id: item.id, title: item.title, summary: item.summary, sourceName: item.source.name,
          publishedAt: item.publishedAt, score: item.score, aiSelected: item.selected,
        });
        if (added) setPulse((p) => p + 1);
      }}
      style={{ width: size, height: size }}
      className={`relative z-10 inline-flex shrink-0 items-center justify-center rounded-control transition-colors duration-150 ${on ? "text-accent" : "text-ink-4 hover:bg-bg-sunk hover:text-ink-2"} ${className}`}
    >
      <span key={pulse} className={`flex ${pulse ? "anim-bump" : ""}`}>
        <IconBookmark size={Math.round(size * 0.6)} filled={on} />
      </span>
    </button>
  );
}
