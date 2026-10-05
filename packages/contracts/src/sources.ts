import type { PolicySourceState } from "./policy-sources.ts";
import type { SourceDimension } from "./site.ts";

/** Public source metadata; collection configuration and credentials stay in the admin API. */
export interface SourceCatalogEntry {
  id: string;
  name: string;
  url: string | null;
  tags: string[];
  sourceDimension: SourceDimension;
  firstParty: boolean;
  tier: string;
  enabled: boolean;
  intervalMinutes: number;
  state: PolicySourceState;
  lastSuccessAt: string | null;
  lastAttemptAt: string | null;
  publishedCount: number;
}

export interface SourceCatalogResponse {
  generatedAt: string;
  sources: SourceCatalogEntry[];
}
