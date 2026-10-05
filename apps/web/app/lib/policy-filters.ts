export const POLICY_FILTER_KEYS = ["issuer", "region", "stage", "documentType"] as const;
export type PolicyFilterKey = typeof POLICY_FILTER_KEYS[number];

/** Repeated query values are OR-ed inside one dimension; dimensions remain independent. */
export function policyFilterValues(params: URLSearchParams, key: PolicyFilterKey): string[] {
  return [...new Set(params.getAll(key).map(value => value.trim().slice(0, 80)).filter(Boolean))].slice(0, 20);
}

export function togglePolicyFilter(params: URLSearchParams, key: PolicyFilterKey, value: string): string {
  const next = new URLSearchParams(params);
  const values = policyFilterValues(params, key);
  next.delete(key);
  for (const entry of values.includes(value) ? values.filter(entry => entry !== value) : [...values, value]) next.append(key, entry);
  next.set("category", "policy");
  next.delete("page");
  next.delete("cursor");
  return `/all?${next}`;
}

export function policyTagHref(tag: string, category: string | null, params?: URLSearchParams): string {
  const scoped = category === "first-hand" || category === "policy" || category === "supply-chain";
  const next = scoped ? new URLSearchParams(params) : new URLSearchParams();
  if (params?.get("channel") === "firstParty") next.set("channel", "firstParty");
  next.set("tag", tag);
  if (scoped) next.set("category", category);
  next.delete("page");
  next.delete("cursor");
  return `/all?${next}`;
}

export function appendPolicyFilters(params: URLSearchParams, filters: { issuers?: string[]; regions?: string[]; stages?: string[]; documentTypes?: string[] }) {
  const values = { issuer: filters.issuers, region: filters.regions, stage: filters.stages, documentType: filters.documentTypes };
  for (const key of POLICY_FILTER_KEYS) for (const value of values[key] ?? []) params.append(key, value);
  return params;
}

export function policyFiltersFromParams(params: URLSearchParams) {
  return {
    issuers: policyFilterValues(params, "issuer"),
    regions: policyFilterValues(params, "region"),
    stages: policyFilterValues(params, "stage"),
    documentTypes: policyFilterValues(params, "documentType"),
  };
}

/** Public evidence links may open web pages or documents, never script or local URLs. */
export function publicEvidenceUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}
