import { DISCLOSURE_TOPICS } from "@aihot/industry/taxonomy";
import { hrefWith } from "./feed-filters.ts";

export function disclosureTopicName(slug: string | null | undefined): string | null {
  return DISCLOSURE_TOPICS.find(topic => topic.slug === slug)?.name ?? null;
}

/** A disclosure subject starts a fresh result set and keeps the reader's evidence filters. */
export function disclosureTopicHref(params: URLSearchParams, topic: string | null): string {
  return hrefWith("/all", params, {
    category: "first-hand", topic, tag: null,
    issuer: null, region: null, stage: null, documentType: null, view: null,
  });
}
