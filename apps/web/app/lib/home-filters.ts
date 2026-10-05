import { isCategoryKey, isChannelKey } from "@aihot/contracts/taxonomy";
import type { TimelineFilters } from "@aihot/contracts/site";

export function homeFilters(params: URLSearchParams): TimelineFilters {
  const channel = params.get("channel");
  const category = params.get("category");
  return {
    channel: isChannelKey(channel) ? channel : "all",
    category: isCategoryKey(category) ? category : null,
    tag: params.get("tag")?.trim().slice(0, 60) || null,
    topic: null,
  };
}

/** Search lives in the full collection and retains the chosen filters. */
export function homeRedirect(params: URLSearchParams): string | null {
  return params.get("q")?.trim() ? `/all?${params}` : null;
}
