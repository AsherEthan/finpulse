import { FetchError, type Candidate, type SourceRow } from "./types.ts";

export interface ListingWindow { candidates: Candidate[]; pages: number; truncated: boolean }

/** Read a bounded recent window; hitting the cap is reported, never silently claimed as complete. */
export async function readListingWindow(source: SourceRow, fetchPage: (source: SourceRow) => Promise<Candidate[]>): Promise<ListingWindow> {
  const p = source.config.pagination;
  if (!p) return { candidates: await fetchPage(source), pages: 1, truncated: false };
  const maxPages = Math.min(Math.max(Math.floor(Number(p.maxPages)) || 1, 1), 3);
  const configuredStart = Number(p.startPage ?? 1);
  const start = Number.isFinite(configuredStart) ? Math.max(Math.floor(configuredStart), 0) : 1;
  if (!p.urlTemplate && !p.pageParam && !p.bodyPageField) throw new FetchError("pagination address missing");
  const candidates: Candidate[] = [];
  const seen = new Set<string>();
  let pages = 0;
  let truncated = false;
  for (let i = 0; i < maxPages; i++) {
    const page = start + i;
    const url = new URL(i === 0 && p.firstPageUrl ? String(p.firstPageUrl)
      : p.urlTemplate ? String(p.urlTemplate).replaceAll("{page}", String(page)) : String(source.config.url));
    if (url.origin !== new URL(String(source.config.url)).origin) throw new FetchError("pagination must remain on the listing origin");
    if (p.pageParam) url.searchParams.set(String(p.pageParam), String(page));
    const config = { ...source.config, url: url.toString(),
      ...(p.bodyPageField ? source.config.bodyForm !== undefined
        ? { bodyForm: { ...source.config.bodyForm, [String(p.bodyPageField)]: page } }
        : { bodyJson: { ...source.config.bodyJson, [String(p.bodyPageField)]: page } } : {}) };
    const result = await fetchPage({ ...source, config });
    pages += 1;
    let added = 0;
    for (const item of result) {
      if (seen.has(item.url)) continue;
      seen.add(item.url); candidates.push(item); added += 1;
    }
    // Empty/short pages establish the end; a server ignoring page parameters cannot loop.
    if (!added) { truncated = result.length > 0; break; }
    if (p.pageSize && result.length < Number(p.pageSize)) break;
    if (i === maxPages - 1) truncated = true;
  }
  return { candidates, pages, truncated };
}
