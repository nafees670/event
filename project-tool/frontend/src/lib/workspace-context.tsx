"use client";

import { useQuery } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { authApi } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { orgsApi, queryKeys } from "@/lib/api/orgs";
import type { Organization, Space, User } from "@/lib/api/types";
import { safeStorage } from "@/lib/storage";

const ORG_KEY = "pm.currentOrg";
const spaceKey = (orgId: number) => `pm.currentSpace.${orgId}`;

/** "all" is only offered to organization admins. */
export type SpaceSelection = number | "all";

interface WorkspaceContextValue {
  user: User | undefined;
  orgs: Organization[];
  currentOrg: Organization | null;
  isOrgAdmin: boolean;
  setCurrentOrgId: (id: number) => void;
  spaces: Space[];
  /** True when the backend says the user has no space in this org. */
  noSpaceAssigned: boolean;
  spaceSelection: SpaceSelection | null;
  setSpaceSelection: (selection: SpaceSelection) => void;
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const meQuery = useQuery({ queryKey: queryKeys.me, queryFn: () => authApi.me() });
  const orgsQuery = useQuery({ queryKey: queryKeys.orgs, queryFn: orgsApi.list, enabled: meQuery.isSuccess });
  const [orgId, setOrgId] = useState<number | null>(null);
  const [spaceSelection, setSpaceSelectionState] = useState<SpaceSelection | null>(null);

  const orgs = useMemo(() => orgsQuery.data ?? [], [orgsQuery.data]);

  // Restore the last org, falling back to the first one the user belongs to.
  useEffect(() => {
    if (!orgs.length) return;
    if (orgId !== null && orgs.some((o) => o.id === orgId)) return;
    const stored = Number(safeStorage.get(ORG_KEY));
    setOrgId(orgs.find((o) => o.id === stored)?.id ?? orgs[0]?.id ?? null);
  }, [orgs, orgId]);

  const currentOrg = orgs.find((o) => o.id === orgId) ?? null;
  const isOrgAdmin = currentOrg?.my_role === "ADMIN";

  const spacesQuery = useQuery({
    queryKey: currentOrg ? queryKeys.spaces(currentOrg.id) : ["spaces", "none"],
    queryFn: () => orgsApi.spaces(currentOrg!.id),
    enabled: currentOrg !== null,
    retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
  });
  const noSpaceAssigned = spacesQuery.error instanceof ApiError && spacesQuery.error.code === "no_space_assigned";
  const spaces = useMemo(() => spacesQuery.data ?? [], [spacesQuery.data]);

  useEffect(() => {
    if (!currentOrg || !spacesQuery.isSuccess) return;
    const stored = safeStorage.get(spaceKey(currentOrg.id));
    const valid = (value: SpaceSelection) => (value === "all" ? isOrgAdmin : spaces.some((s) => s.id === value));
    const parsed: SpaceSelection | null = stored === "all" ? "all" : stored ? Number(stored) : null;
    if (parsed !== null && valid(parsed)) setSpaceSelectionState(parsed);
    else setSpaceSelectionState(isOrgAdmin ? "all" : (spaces[0]?.id ?? null));
  }, [currentOrg, spaces, spacesQuery.isSuccess, isOrgAdmin]);

  const setCurrentOrgId = useCallback((id: number) => {
    safeStorage.set(ORG_KEY, String(id));
    setOrgId(id);
  }, []);

  const setSpaceSelection = useCallback(
    (selection: SpaceSelection) => {
      if (currentOrg) safeStorage.set(spaceKey(currentOrg.id), String(selection));
      setSpaceSelectionState(selection);
    },
    [currentOrg],
  );

  const value: WorkspaceContextValue = {
    user: meQuery.data,
    orgs,
    currentOrg,
    isOrgAdmin,
    setCurrentOrgId,
    spaces,
    noSpaceAssigned,
    spaceSelection,
    setSpaceSelection,
    isLoading: meQuery.isPending || (meQuery.isSuccess && orgsQuery.isPending),
    error: meQuery.error ?? orgsQuery.error,
    refetch: () => {
      void meQuery.refetch();
      void orgsQuery.refetch();
    },
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside <WorkspaceProvider>.");
  return ctx;
}

/** For pages that only render once an organization is selected. */
export function useCurrentOrg(): Organization {
  const { currentOrg } = useWorkspace();
  if (!currentOrg) throw new Error("useCurrentOrg used before an organization was selected.");
  return currentOrg;
}
