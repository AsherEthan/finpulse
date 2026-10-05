export type PolicySourceState = "never_collected" | "ok" | "no_update" | "failed" | "paused" | "stale";

export interface PolicySourceRun {
  found: number;
  new: number;
  revised: number;
  windowFrom: string | null;
  windowTo: string | null;
  pages: number;
  truncated: boolean;
}

export interface PolicySourceHealth {
  id: string;
  name: string;
  url: string | null;
  topics: string[];
  intervalMinutes: number;
  enabled: boolean;
  state: PolicySourceState;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  failureReason: string | null;
  latestPublishedAt: string | null;
  lastRun: PolicySourceRun | null;
  publishedCount: number;
  pendingReviewCount: number;
}

export interface PolicySourcesResponse {
  generatedAt: string;
  totals: {
    configured: number;
    ok: number;
    noUpdate: number;
    failed: number;
    neverCollected: number;
    paused: number;
    stale: number;
    pendingReview: number;
  };
  sources: PolicySourceHealth[];
  limitations: Array<{ id: string; name: string; url: string; reason: string }>;
}
