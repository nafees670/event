"use client";

import { useQuery } from "@tanstack/react-query";
import { ChartColumn } from "lucide-react";
import Link from "next/link";

import { CapacityMeter, ChartCard, StatTile, StatusBreakdown, VelocityChart } from "@/components/analytics/charts";
import { NoSpaceNotice } from "@/components/NoSpaceNotice";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressBar, ProgressRing } from "@/components/ui/ProgressRing";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { analyticsApi, analyticsKeys } from "@/lib/api/analytics";
import type { Analytics } from "@/lib/api/types";
import { usePermissions } from "@/lib/hooks/useSpaceData";
import { formatDay, projectStatusMeta, timeAgo } from "@/lib/tasks";
import { useCurrentOrg, useWorkspace } from "@/lib/workspace-context";

function ProjectsCard({ projects }: { projects: Analytics["projects"] }) {
  return (
    <ChartCard title="Project progress" description="Weighted by milestone. Highest first.">
      {projects.length === 0 ? (
        <p className="text-[13px] text-muted">No active projects.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                href={`/projects/${p.id}`}
                className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:border-border-strong hover:bg-surface-2/50"
              >
                <ProgressRing value={p.progress} label={`${p.short_code} progress`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-fg">
                    <span className="font-mono text-xs text-subtle">{p.short_code}</span> {p.name}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {p.open_tasks} open · {p.completed_tasks} done
                    {p.overdue_tasks > 0 && <span className="font-medium text-fg"> · {p.overdue_tasks} overdue</span>}
                  </p>
                  <p className="mt-0.5 flex items-center gap-2 text-xs text-subtle">
                    <Badge tone={projectStatusMeta(p.status).tone}>{projectStatusMeta(p.status).label}</Badge>
                    {p.target_date && <span>Target {formatDay(p.target_date)}</span>}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </ChartCard>
  );
}

function WorkloadCard({ rows, capacity }: { rows: Analytics["workload"]; capacity: number }) {
  return (
    <ChartCard title="Workload" description={`Open tasks per person. ${capacity} open tasks count as a full load.`}>
      {rows.length === 0 ? (
        <p className="text-[13px] text-muted">No one to show yet.</p>
      ) : (
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-[13px]">
            <thead className="border-b border-border text-xs text-muted">
              <tr>
                <th className="px-5 py-2 font-medium">Person</th>
                <th className="py-2 text-right font-medium">Open</th>
                <th className="py-2 text-right font-medium">In progress</th>
                <th className="py-2 text-right font-medium">Overdue</th>
                <th className="py-2 text-right font-medium">Done (30d)</th>
                <th className="px-5 py-2 font-medium">Capacity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border tabular-nums">
              {rows.map((row) => (
                <tr key={row.user.id}>
                  <td className="px-5 py-2.5">
                    <span className="flex items-center gap-2">
                      <Avatar user={row.user} size="sm" />
                      <span className="truncate font-medium text-fg">{row.user.display_name}</span>
                    </span>
                  </td>
                  <td className="py-2.5 text-right text-fg">{row.open}</td>
                  <td className="py-2.5 text-right text-fg">{row.in_progress}</td>
                  <td className="py-2.5 text-right text-fg">{row.overdue}</td>
                  <td className="py-2.5 text-right text-fg">{row.completed_last_30_days}</td>
                  <td className="px-5 py-2.5">
                    <CapacityMeter value={row.utilization} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ChartCard>
  );
}

function SpacesCard({ spaces }: { spaces: NonNullable<Analytics["spaces"]> }) {
  return (
    <ChartCard title="Spaces" description="Every department at a glance. Progress is the average of its projects.">
      <div className="-mx-5 overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-[13px]">
          <thead className="border-b border-border text-xs text-muted">
            <tr>
              <th className="px-5 py-2 font-medium">Space</th>
              <th className="py-2 text-right font-medium">Projects</th>
              <th className="py-2 pl-6 font-medium">Avg. progress</th>
              <th className="py-2 text-right font-medium">Open</th>
              <th className="py-2 text-right font-medium">Overdue</th>
              <th className="px-5 py-2 text-right font-medium">Done</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border tabular-nums">
            {spaces.map((s) => (
              <tr key={s.id}>
                <td className="px-5 py-2.5">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
                    <span className="font-medium text-fg">{s.name}</span>
                    <span className="font-mono text-xs text-subtle">{s.short_code}</span>
                  </span>
                </td>
                <td className="py-2.5 text-right text-fg">{s.project_count}</td>
                <td className="py-2.5 pl-6">
                  <span className="flex items-center gap-2">
                    <ProgressBar value={s.average_progress} label={`${s.name} average progress`} className="w-24" />
                    <span className="text-xs text-fg">{Math.round(s.average_progress)}%</span>
                  </span>
                </td>
                <td className="py-2.5 text-right text-fg">{s.open_tasks}</td>
                <td className="py-2.5 text-right text-fg">{s.overdue_tasks}</td>
                <td className="px-5 py-2.5 text-right text-fg">{s.completed_tasks}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}

function Dashboard({ data }: { data: Analytics }) {
  const { kpis } = data;
  return (
    <div className="space-y-6">
      <div className="grid animate-slide-up gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Open tasks" value={kpis.open} note={`${kpis.due_this_week} due in the next 7 days`} />
        <StatTile label="In progress" value={kpis.in_progress} note="Started or in review" />
        <StatTile
          label="Overdue"
          value={kpis.overdue}
          alert={kpis.overdue > 0 ? "Past their due date" : undefined}
          note="Nothing past due"
        />
        <StatTile label="Completed this week" value={kpis.completed_last_7_days} note={`${kpis.completed} completed in total`} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <VelocityChart data={data.velocity} />
        <StatusBreakdown data={data.status_distribution} />
      </div>
      {data.spaces && <SpacesCard spaces={data.spaces} />}
      <ProjectsCard projects={data.projects} />
      <WorkloadCard rows={data.workload} capacity={data.capacity} />
    </div>
  );
}

export default function AnalyticsPage() {
  const org = useCurrentOrg();
  const { spaces, spaceSelection, isOrgAdmin, noSpaceAssigned } = useWorkspace();
  const { canManage } = usePermissions();
  const space = typeof spaceSelection === "number" ? spaces.find((s) => s.id === spaceSelection) : undefined;
  const allowed = spaceSelection === "all" ? isOrgAdmin : canManage(space);

  const analytics = useQuery({
    queryKey: analyticsKeys.scope(org.id, spaceSelection ?? "all"),
    queryFn: () => analyticsApi.get(org.id, space?.id),
    enabled: spaceSelection !== null && allowed,
    refetchInterval: 60_000,
  });

  if (noSpaceAssigned) return <NoSpaceNotice />;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Analytics"
        description={
          <>
            {space ? `${space.name} space` : "Company-wide, all spaces"}
            {analytics.data && <span className="text-subtle"> · updated {timeAgo(analytics.data.generated_at)}</span>}
          </>
        }
      />
      {!allowed ? (
        <EmptyState
          icon={ChartColumn}
          title="Analytics are for managers"
          description={
            spaceSelection === "all"
              ? "The company-wide view is for organization admins."
              : "Space analytics are for organization admins and the space's managers. Pick a space you manage in the top bar."
          }
        />
      ) : analytics.isError ? (
        <ErrorState error={analytics.error} onRetry={() => void analytics.refetch()} />
      ) : analytics.isPending ? (
        <div role="status" aria-label="Loading analytics" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-72 rounded-xl" />
        </div>
      ) : (
        <Dashboard data={analytics.data} />
      )}
    </div>
  );
}
