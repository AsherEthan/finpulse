/** Change list filters without carrying paging state into a different result set. */
export function hrefWith(base: string, params: URLSearchParams, patch: Record<string, string | null>) {
  const next = new URLSearchParams(params);
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
  }
  next.delete("page");
  next.delete("cursor");
  const query = next.toString();
  return query ? `${base}?${query}` : base;
}

/** Main columns and first-party source identity can be selected together on either feed. */
export function categoryHref(base: string, params: URLSearchParams, category: string | null) {
  const current = params.get("category");
  const leavingScopedColumn = (current === "first-hand" || current === "policy" || current === "supply-chain" || current === "capital-flow" || current === "papers") && category !== current;
  return hrefWith(base, params, {
    ...(category === null || category !== current ? { topic: null } : {}),
    ...(leavingScopedColumn ? { tag: null } : {}),
    ...(current === "policy" && category !== current ? { issuer: null, region: null, stage: null, documentType: null } : {}),
    category,
    channel: params.get("channel") === "firstParty" ? "firstParty" : null,
  });
}

/** Source identity is independent of the current column, topics, search and policy dimensions. */
export function firstPartyHref(base: string, params: URLSearchParams) {
  return hrefWith(base, params, { channel: params.get("channel") === "firstParty" ? null : "firstParty" });
}
