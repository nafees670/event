import { apiFetch } from "./client";
import type { Analytics } from "./types";

export const analyticsApi = {
  get: (orgId: number, space?: number) => apiFetch<Analytics>(`/orgs/${orgId}/analytics/`, { query: { space } }),
};

export const analyticsKeys = {
  all: (orgId: number) => ["orgs", orgId, "analytics"] as const,
  scope: (orgId: number, space: number | "all") => ["orgs", orgId, "analytics", space] as const,
};
