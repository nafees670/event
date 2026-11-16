"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { projectKeys, projectsApi } from "@/lib/api/projects";
import { spaceKeys, spacesApi } from "@/lib/api/spaces";
import type { Space } from "@/lib/api/types";
import { useCurrentOrg, useWorkspace, type SpaceSelection } from "@/lib/workspace-context";

const FIVE_MINUTES = 5 * 60 * 1000;

export function useSpaceStates(spaceId: number | null | undefined) {
  const org = useCurrentOrg();
  return useQuery({
    queryKey: spaceKeys.states(org.id, spaceId ?? 0),
    queryFn: () => spacesApi.states(org.id, spaceId!),
    enabled: !!spaceId,
    staleTime: FIVE_MINUTES,
  });
}

export function useSpaceFields(spaceId: number | null | undefined) {
  const org = useCurrentOrg();
  return useQuery({
    queryKey: spaceKeys.fields(org.id, spaceId ?? 0),
    queryFn: () => spacesApi.fields(org.id, spaceId!),
    enabled: !!spaceId,
    staleTime: FIVE_MINUTES,
  });
}

export function useSpaceTags(spaceId: number | null | undefined) {
  const org = useCurrentOrg();
  return useQuery({
    queryKey: spaceKeys.tags(org.id, spaceId ?? 0),
    queryFn: () => spacesApi.tags(org.id, spaceId!),
    enabled: !!spaceId,
    staleTime: FIVE_MINUTES,
  });
}

export function useParticipants(spaceId: number | null | undefined) {
  const org = useCurrentOrg();
  return useQuery({
    queryKey: spaceKeys.participants(org.id, spaceId ?? 0),
    queryFn: () => spacesApi.participants(org.id, spaceId!),
    enabled: !!spaceId,
    staleTime: FIVE_MINUTES,
  });
}

/** Projects of the selected space, or of every visible space for "all". */
export function useProjects(selection: SpaceSelection | null) {
  const org = useCurrentOrg();
  return useQuery({
    queryKey: projectKeys.list(org.id, selection ?? "all"),
    queryFn: () => projectsApi.list(org.id, typeof selection === "number" ? { space: selection } : {}),
    enabled: selection !== null,
    select: (page) => page.results,
  });
}

/** Permission helpers mirroring the backend rules (the API still enforces them). */
export function usePermissions() {
  const { isOrgAdmin } = useWorkspace();
  // Stable identities, so callers can use them in memo/effect dependencies.
  return useMemo(
    () => ({
      canManage: (space: Space | undefined) => !!space && (isOrgAdmin || space.my_role === "MANAGER"),
      canContribute: (space: Space | undefined) =>
        !!space && (isOrgAdmin || space.my_role === "MANAGER" || space.my_role === "EMPLOYEE"),
    }),
    [isOrgAdmin],
  );
}
