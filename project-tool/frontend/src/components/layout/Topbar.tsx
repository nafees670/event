"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronsUpDown, LogOut, Menu as MenuIcon, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";

import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Menu, type MenuItem } from "@/components/ui/Menu";
import { signOut } from "@/lib/session";
import { useWorkspace } from "@/lib/workspace-context";

function OrgSwitcher() {
  const { orgs, currentOrg, setCurrentOrgId } = useWorkspace();
  const router = useRouter();
  if (!currentOrg) return null;

  const items: MenuItem[] = [
    ...orgs.map((org) => ({
      key: String(org.id),
      active: org.id === currentOrg.id,
      label: (
        <>
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-surface-3 text-[10px] font-semibold">
            {org.name[0]?.toUpperCase()}
          </span>
          <span className="flex-1 truncate">{org.name}</span>
          {org.id === currentOrg.id && <Check className="h-4 w-4 text-primary" aria-hidden />}
        </>
      ),
      onSelect: () => setCurrentOrgId(org.id),
    })),
    {
      key: "new",
      label: (
        <>
          <Plus className="h-4 w-4 text-subtle" aria-hidden /> New organization
        </>
      ),
      onSelect: () => router.push("/onboarding"),
    },
  ];

  return (
    <Menu
      label="Switch organization"
      items={items}
      header="Organizations"
      trigger={
        <>
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-slate-700 to-slate-900 text-[11px] font-semibold text-white dark:from-slate-200 dark:to-slate-400 dark:text-slate-900">
            {currentOrg.name[0]?.toUpperCase()}
          </span>
          <span className="max-w-[9rem] truncate font-medium">{currentOrg.name}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 text-subtle" aria-hidden />
        </>
      }
    />
  );
}

function SpaceSwitcher() {
  const { spaces, spaceSelection, setSpaceSelection, isOrgAdmin, noSpaceAssigned } = useWorkspace();
  if (noSpaceAssigned || spaceSelection === null) return null;

  const current = spaceSelection === "all" ? null : spaces.find((s) => s.id === spaceSelection);
  const items: MenuItem[] = [
    // "All Spaces" exists only for organization admins.
    ...(isOrgAdmin
      ? [
          {
            key: "all",
            active: spaceSelection === "all",
            label: (
              <>
                <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-br from-indigo-400 to-fuchsia-400" aria-hidden />
                <span className="flex-1">All Spaces</span>
                {spaceSelection === "all" && <Check className="h-4 w-4 text-primary" aria-hidden />}
              </>
            ),
            onSelect: () => setSpaceSelection("all"),
          },
        ]
      : []),
    ...spaces.map((space) => ({
      key: String(space.id),
      active: space.id === spaceSelection,
      label: (
        <>
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: space.color }} aria-hidden />
          <span className="flex-1 truncate">{space.name}</span>
          <span className="font-mono text-[10px] text-subtle">{space.short_code}</span>
          {space.id === spaceSelection && <Check className="h-4 w-4 text-primary" aria-hidden />}
        </>
      ),
      onSelect: () => setSpaceSelection(space.id),
    })),
  ];

  return (
    <>
      <span className="text-border-strong" aria-hidden>
        /
      </span>
      <Menu
        label="Switch space"
        items={items}
        header="Spaces"
        trigger={
          <>
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={current ? { backgroundColor: current.color } : undefined}
              aria-hidden
            />
            <span className="max-w-[8rem] truncate">{current ? current.name : "All Spaces"}</span>
            <ChevronsUpDown className="h-3.5 w-3.5 text-subtle" aria-hidden />
          </>
        }
      />
    </>
  );
}

function UserMenu() {
  const { user, currentOrg } = useWorkspace();
  const queryClient = useQueryClient();
  if (!user) return null;

  return (
    <Menu
      label="Account"
      align="right"
      header={
        <div className="flex items-center gap-2.5">
          <Avatar user={user} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-fg">{user.display_name}</p>
            <p className="truncate">{user.email}</p>
          </div>
          {currentOrg && <Badge tone="indigo">{currentOrg.my_role}</Badge>}
        </div>
      }
      items={[
        {
          key: "logout",
          label: (
            <>
              <LogOut className="h-4 w-4 text-subtle" aria-hidden /> Sign out
            </>
          ),
          onSelect: () => void signOut(queryClient),
        },
      ]}
      trigger={<Avatar user={user} />}
    />
  );
}

export function Topbar({ onOpenMenu, onOpenPalette }: { onOpenMenu: () => void; onOpenPalette: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-1 border-b border-border bg-surface/80 px-3 backdrop-blur-md sm:px-5">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Open navigation"
        className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-fg lg:hidden"
      >
        <MenuIcon className="h-5 w-5" />
      </button>
      <div className="flex min-w-0 items-center gap-0.5">
        <OrgSwitcher />
        <SpaceSwitcher />
      </div>
      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={onOpenPalette}
          aria-label="Open command palette"
          className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-fg lg:hidden"
        >
          <Search className="h-4 w-4" />
        </button>
        <UserMenu />
      </div>
    </header>
  );
}
