import { ECONOMICS_TOPICS } from "@aihot/industry/taxonomy";
import { hrefWith } from "./feed-filters.ts";

export function economicsTopicName(slug: string | null | undefined): string | null {
  return ECONOMICS_TOPICS.find(topic => topic.slug === slug)?.name ?? null;
}

/** A different research subject starts a fresh result set but keeps the reader's evidence filters. */
export function paperTopicHref(params: URLSearchParams, topic: string | null): string {
  return hrefWith("/all", params, {
    category: "papers", topic, tag: null,
    issuer: null, region: null, stage: null, documentType: null, view: null,
  });
}
