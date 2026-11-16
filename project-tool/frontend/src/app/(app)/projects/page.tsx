"use client";

import { CalendarClock, FolderKanban, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { NoSpaceNotice } from "@/components/NoSpaceNotice";
import { ProjectFormDialog } from "@/components/projects/ProjectFormDialog";
import { ProjectProgress } from "@/components/projects/ProjectProgress";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { controlClass } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import type { Project } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { usePermissions, useProjects } from "@/lib/hooks/useSpaceData";
import { formatDay, projectStatusMeta } from "@/lib/tasks";
import { useWorkspace } from "@/lib/workspace-context";

function ProjectCard({ project, color }: { project: Project; color: string }) {
  const status = projectStatusMeta(project.status);
  return (
    <Link
      href={`/projects/${project.id}`}
      className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-pop"
    >
      <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: color }} />
      <div className="flex items-start gap-3">
        <span className="rounded-md bg-surface-2 px-2 py-1 font-mono text-xs font-semibold text-fg ring-1 ring-border">
          {project.short_code}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-fg group-hover:text-primary">{project.name}</p>
          <p className="font-mono text-[11px] text-subtle">{project.space_code}</p>
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      {project.description && <p className="mt-3 line-clamp-2 text-[13px] text-muted">{project.description}</p>}
      <div className="mt-auto space-y-3 pt-5">
        <ProjectProgress project={project} />
        <div className="flex items-center gap-3 text-xs text-muted">
          {project.lead ? (
            <span className="flex min-w-0 items-center gap-1.5">
              <Avatar user={project.lead} size="sm" />
              <span className="truncate">{project.lead.display_name}</span>
            </span>
          ) : (
            <span className="text-subtle">No lead</span>
          )}
          {project.target_date && (
            <span className="ml-auto flex shrink-0 items-center gap-1">
              <CalendarClock className="h-3.5 w-3.5" aria-hidden />
              {formatDay(project.target_date)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function ProjectsPage() {
  const { spaces, spaceSelection, noSpaceAssigned } = useWorkspace();
  const { canManage } = usePermissions();
  const projects = useProjects(spaceSelection);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  const managed = useMemo(() => spaces.filter((s) => canManage(s)), [spaces, canManage]);
  const current = typeof spaceSelection === "number" ? spaces.find((s) => s.id === spaceSelection) : undefined;
  const colorOf = (spaceId: number) => spaces.find((s) => s.id === spaceId)?.color ?? "#94A3B8";
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = projects.data ?? [];
    return q ? list.filter((p) => `${p.name} ${p.short_code}`.toLowerCase().includes(q)) : list;
  }, [projects.data, query]);
  const canCreate = current ? canManage(current) : managed.length > 0;

  if (noSpaceAssigned) return <NoSpaceNotice />;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Projects"
        description={current ? `Projects in ${current.name}` : "Projects across all spaces"}
        actions={
          canCreate && (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" aria-hidden /> New project
            </Button>
          )
        }
      />

      {(projects.data?.length ?? 0) > 6 && (
        <div className="relative mb-5 max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-subtle" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter projects"
            aria-label="Filter projects"
            className={cn(controlClass, "h-8 border-border pl-8 text-[13px]")}
          />
        </div>
      )}

      {projects.isError ? (
        <ErrorState error={projects.error} onRetry={() => void projects.refetch()} />
      ) : projects.isPending ? (
        <div role="status" aria-label="Loading projects" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={query ? "No matching projects" : "No projects yet"}
          description={
            query
              ? "Try another name or code."
              : canCreate
                ? "Projects group milestones and tasks. Create one to get started."
                : "A space manager will add projects here."
          }
          action={
            canCreate &&
            !query && (
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus className="h-4 w-4" aria-hidden /> New project
              </Button>
            )
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((project, i) => (
            <li key={project.id} className="animate-slide-up" style={{ animationDelay: `${i * 30}ms`, animationFillMode: "backwards" }}>
              <ProjectCard project={project} color={colorOf(project.space)} />
            </li>
          ))}
        </ul>
      )}

      <ProjectFormDialog
        open={creating}
        onClose={() => setCreating(false)}
        spaces={managed}
        defaultSpace={current && canManage(current) ? current.id : managed.length === 1 ? managed[0]!.id : undefined}
      />
    </div>
  );
}
