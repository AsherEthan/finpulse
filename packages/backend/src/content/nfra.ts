// NFRA article pages render their public document from this same-origin JSON endpoint.
import { readable, type ExtractedBody } from "./extract.ts";

export function nfraDocumentUrl(articleUrl: string): string | null {
  const url = new URL(articleUrl);
  if (url.protocol !== "https:" || url.hostname !== "www.nfra.gov.cn" || url.port || url.username || url.password) return null;
  if (!/^\/cn\/view\/pages\/(rulesDetail|governmentDetail)\.html$/.test(url.pathname)) return null;
  const id = url.searchParams.get("docId");
  return id && /^\d+$/.test(id) ? `https://www.nfra.gov.cn/cbircweb/DocInfo/SelectByDocId?docId=${id}` : null;
}

export function nfraDocumentBody(data: unknown, articleUrl: string): ExtractedBody | null {
  if (!data || typeof data !== "object") return null;
  const document = (data as { data?: { docClob?: unknown } }).data;
  if (!document || typeof document.docClob !== "string" || !document.docClob.trim()) return null;
  return readable(`<html><head></head><body><article>${document.docClob}</article></body></html>`, articleUrl);
}
