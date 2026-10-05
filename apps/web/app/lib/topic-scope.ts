import { isCategoryKey, type CategoryKey } from "@aihot/contracts/taxonomy";
import { DISCLOSURE_TOPICS } from "@aihot/industry/taxonomy";

export interface TopicScope {
  view: "all" | "selected";
  category: CategoryKey | null;
}

export function defaultTopicScope(slug: string): TopicScope {
  if (DISCLOSURE_TOPICS.some(topic => topic.slug === slug)) return { view: "all", category: "first-hand" };
  if (slug === "papers" || slug.startsWith("econ-")) return { view: "all", category: "papers" };
  if (slug.startsWith("policy-")) return { view: "all", category: "policy" };
  return { view: "selected", category: null };
}

export function topicScopeFromParams(slug: string, params: URLSearchParams): TopicScope {
  const defaults = defaultTopicScope(slug);
  const view = params.get("view");
  const category = params.get("category");
  return {
    view: view === "all" || view === "selected" ? view : defaults.view,
    category: category && isCategoryKey(category) ? category : defaults.category,
  };
}

export function topicPageHref(slug: string, scope: TopicScope, page = 1): string {
  const params = new URLSearchParams({ view: scope.view });
  if (scope.category) params.set("category", scope.category);
  const path = page > 1 ? `/topics/${slug}/page/${page}` : `/topics/${slug}`;
  return `${path}?${params}`;
}

/** Related topics use their own scope, so paper-only filtering cannot hide a policy or sector topic. */
export function topicEntryHref(slug: string): string {
  const scope = defaultTopicScope(slug);
  return scope.category ? topicPageHref(slug, scope) : `/topics/${slug}`;
}
