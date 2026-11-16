"use client";

import { ArrowRight, Layers, ShieldCheck, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { NoSpaceNotice } from "@/components/NoSpaceNotice";
import { Badge } from "@/components/ui/Badge";
import { Card, PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/States";
import type { Space } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { useCurrentOrg, useWorkspace } from "@/lib/workspace-context";

const DEPARTMENT_LABELS: Record<string, string> = {
  ENGINEERING: "Engineering",
  MARKETING: "Marketing",
  SALES: "Sales",
  OPERATIONS: "Operations",
  HR: "HR",
  GENERAL: "General",
};

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function Stat({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string | number; tone: string }) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", tone)}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div>
        <p className="text-[13px] text-muted">{label}</p>
        <p className="text-xl font-semibold tracking-tight text-fg">{value}</p>
      </div>
    </Card>
  );
}

function SpaceCard({ space, selected, onSelect }: { space: Space; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "group relative w-full overflow-hidden rounded-xl border bg-surface p-5 text-left shadow-card transition-all duration-200",
        "hover:-translate-y-0.5 hover:shadow-pop",
        selected ? "border-primary/50 ring-2 ring-primary/20" : "border-border hover:border-border-strong",
      )}
    >
      <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: space.color }} />
      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm"
          style={{ backgroundColor: space.color }}
          aria-hidden
        >
          {space.short_code.slice(0, 2)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-fg">{space.name}</p>
          <p className="font-mono text-xs text-subtle">{space.short_code}</p>
        </div>
        <ArrowRight
          className="h-4 w-4 -translate-x-1 text-subtle opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
          aria-hidden
        />
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-1.5">
        <Badge>{DEPARTMENT_LABELS[space.department_type] ?? space.department_type}</Badge>
        {space.my_role && <Badge tone="emerald">{space.my_role.toLowerCase()}</Badge>}
        <span className="ml-auto flex items-center gap-1 text-xs text-muted">
          <Users className="h-3.5 w-3.5" aria-hidden />
          {space.member_count}
        </span>
      </div>
    </button>
  );
}

export default function DashboardPage() {
  const org = useCurrentOrg();
  const { user, spaces, noSpaceAssigned, isOrgAdmin, spaceSelection, setSpaceSelection } = useWorkspace();

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={`${greeting()}${user ? `, ${user.display_name.split(" ")[0]}` : ""}`}
        description={`Here's what's happening in ${org.name}.`}
      />

      <div className="grid animate-slide-up gap-4 sm:grid-cols-3">
        <Stat icon={ShieldCheck} label="Your role" value={org.my_role.toLowerCase()} tone="bg-primary-soft text-primary-soft-fg" />
        <Stat
          icon={Users}
          label="Members"
          value={org.member_count}
          tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
        />
        <Stat
          icon={Layers}
          label={isOrgAdmin ? "Spaces" : "Your spaces"}
          value={noSpaceAssigned ? 0 : spaces.length}
          tone="bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
        />
      </div>

      <section aria-labelledby="spaces-heading" className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="spaces-heading" className="text-[15px] font-semibold text-fg">
            {isOrgAdmin ? "All spaces" : "Your spaces"}
          </h2>
        </div>
        {noSpaceAssigned ? (
          <NoSpaceNotice />
        ) : spaces.length === 0 ? (
          <EmptyState icon={Layers} title="No spaces yet" />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {spaces.map((space, i) => (
              <li key={space.id} className="animate-slide-up" style={{ animationDelay: `${i * 40}ms`, animationFillMode: "backwards" }}>
                <SpaceCard space={space} selected={spaceSelection === space.id} onSelect={() => setSpaceSelection(space.id)} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {isOrgAdmin && (
        <Card className="mt-10 overflow-hidden">
          <div className="flex flex-col gap-4 bg-gradient-to-r from-primary-soft to-transparent p-6 sm:flex-row sm:items-center">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-fg">
              <Users className="h-5 w-5" aria-hidden />
            </span>
            <div className="flex-1">
              <p className="font-medium text-fg">Bring your team in</p>
              <p className="text-sm text-muted">Invite people to {org.name} and put them straight into a space.</p>
            </div>
            <Link
              href="/organization/team"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-fg transition-colors hover:bg-primary-hover"
            >
              Invite people <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}
