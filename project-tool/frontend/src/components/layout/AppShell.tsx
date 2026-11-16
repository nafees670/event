"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { ErrorState, Skeleton } from "@/components/ui/States";
import { useIdleLogout } from "@/lib/hooks/useIdleLogout";
import { useWorkspace, WorkspaceProvider } from "@/lib/workspace-context";

import { CommandPalette } from "./CommandPalette";
import { Logo } from "./Logo";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

function ShellSkeleton() {
  return (
    <div role="status" aria-label="Loading your workspace" className="flex h-full">
      <div className="hidden w-64 shrink-0 space-y-3 border-r border-border bg-surface p-4 lg:block">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-8 w-full" />
        <div className="space-y-2 pt-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
      </div>
      <div className="flex-1">
        <div className="h-14 border-b border-border bg-surface" />
        <div className="mx-auto max-w-5xl space-y-4 p-8">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-40" />
          <div className="grid gap-4 pt-4 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ShellBody({ children }: { children: ReactNode }) {
  const { isLoading, error, refetch, orgs, currentOrg } = useWorkspace();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const needsOnboarding = !isLoading && !error && orgs.length === 0;

  useIdleLogout();

  useEffect(() => {
    if (needsOnboarding && pathname !== "/onboarding") router.replace("/onboarding");
  }, [needsOnboarding, pathname, router]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  if (isLoading) return <ShellSkeleton />;
  if (error) {
    return (
      <div className="mx-auto max-w-lg p-6 pt-24">
        <ErrorState error={error} onRetry={refetch} />
      </div>
    );
  }
  // Before the user has an org, only the onboarding page is meaningful.
  if (needsOnboarding || (!currentOrg && pathname === "/onboarding")) {
    return (
      <main className="flex min-h-full flex-col items-center px-4 pt-16 pb-10">
        <Logo className="mb-8" />
        <div className="w-full max-w-md">{pathname === "/onboarding" ? children : null}</div>
      </main>
    );
  }
  if (!currentOrg) return <ShellSkeleton />;

  return (
    <div className="flex h-full">
      <Sidebar mobileOpen={menuOpen} onClose={closeMenu} onOpenPalette={openPalette} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMenu={() => setMenuOpen(true)} onOpenPalette={openPalette} />
        <main id="main" className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <WorkspaceProvider>
      <ShellBody>{children}</ShellBody>
    </WorkspaceProvider>
  );
}
