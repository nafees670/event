"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderKanban, Plus, Search, SquareKanban, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";

import { NoSpaceNotice } from "@/components/NoSpaceNotice";
import { Board, type BoardColumn } from "@/components/tasks/Board";
import { NewTaskDialog, type NewTaskDefaults } from "@/components/tasks/NewTaskDialog";
import { TaskDrawer } from "@/components/tasks/TaskDrawer";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { controlClass } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/api/client";
import { projectKeys } from "@/lib/api/projects";
import { taskKeys, tasksApi, type TaskFilters } from "@/lib/api/tasks";
import type { Paginated, Priority, Task } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { useParticipants, usePermissions, useProjects, useSpaceStates, useSpaceTags } from "@/lib/hooks/useSpaceData";
import { CATEGORIES, PRIORITIES, categoryMeta } from "@/lib/tasks";
import { useCurrentOrg, useWorkspace } from "@/lib/workspace-context";

const STEP = 1024;
const filterClass = cn(controlClass, "h-8 w-auto border-border pr-8 text-[13px]");

function BoardSkeleton() {
  return (
    <div role="status" aria-label="Loading board" className="flex gap-3 overflow-hidden">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="w-[17.5rem] shrink-0 space-y-2 rounded-xl bg-surface-2/60 p-3">
          <Skeleton className="h-4 w-24" />
          {[0, 1, 2].map((j) => (
            <Skeleton key={j} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ))}
    </div>
  );
}

function useUrlState() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const set = useCallback(
    (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, router, pathname],
  );
  return { params, set };
}

function TaskBoard() {
  const org = useCurrentOrg();
  const { spaces, spaceSelection, noSpaceAssigned, user } = useWorkspace();
  const { canContribute } = usePermissions();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { params, set } = useUrlState();

  const spaceId = typeof spaceSelection === "number" ? spaceSelection : null;
  const space = spaces.find((s) => s.id === spaceId);
  const states = useSpaceStates(spaceId);
  const tags = useSpaceTags(spaceId);
  const participants = useParticipants(spaceId);
  const projects = useProjects(spaceSelection);

  const [search, setSearch] = useState(params.get("q") ?? "");
  useEffect(() => {
    const handle = window.setTimeout(() => {
      if ((params.get("q") ?? "") !== search.trim()) set({ q: search.trim() });
    }, 300);
    return () => window.clearTimeout(handle);
  }, [search, params, set]);

  const filters: TaskFilters = useMemo(
    () => ({
      space: spaceId ?? undefined,
      project: params.get("project") ? Number(params.get("project")) : undefined,
      assignee: params.get("assignee") ?? undefined,
      priority: (params.get("priority") as Priority | null) ?? undefined,
      tag: params.get("tag") ? Number(params.get("tag")) : undefined,
      due: (params.get("due") as TaskFilters["due"] | null) ?? undefined,
      search: params.get("q") ?? undefined,
    }),
    [spaceId, params],
  );
  const listKey = taskKeys.list(org.id, filters);
  const tasks = useQuery({
    queryKey: listKey,
    queryFn: () => tasksApi.list(org.id, filters),
    enabled: spaceSelection !== null && !noSpaceAssigned,
  });

  const columns: BoardColumn[] = useMemo(() => {
    if (spaceId === null) {
      return CATEGORIES.map((c) => ({
        id: `c:${c.value}`,
        title: c.label,
        color: c.color,
        target: { category: c.value },
        matches: (t: Task) => t.state.category === c.value,
      }));
    }
    return (states.data ?? []).map((s) => ({
      id: `s:${s.id}`,
      title: s.name,
      color: s.color,
      target: { state_id: s.id },
      matches: (t: Task) => t.state.id === s.id,
    }));
  }, [spaceId, states.data]);

  const move = useMutation({
    mutationFn: ({ task, column, afterId, beforeId }: { task: Task; column: BoardColumn; afterId: number | null; beforeId: number | null }) =>
      tasksApi.move(org.id, task.id, { ...column.target, after_id: afterId, before_id: beforeId }),
    onMutate: async ({ task, column, afterId, beforeId }) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData<Paginated<Task>>(listKey);
      const byId = new Map(previous?.results.map((t) => [t.id, t]));
      const low = afterId !== null ? byId.get(afterId)?.position : undefined;
      const high = beforeId !== null ? byId.get(beforeId)?.position : undefined;
      const position =
        low !== undefined && high !== undefined ? (low + high) / 2 : low !== undefined ? low + STEP : high !== undefined ? high - STEP : Number.MAX_SAFE_INTEGER;
      const state =
        "state_id" in column.target
          ? (() => {
              const s = states.data?.find((x) => x.id === (column.target as { state_id: number }).state_id);
              return s ? { id: s.id, name: s.name, color: s.color, category: s.category } : task.state;
            })()
          : (() => {
              const meta = categoryMeta(column.target.category);
              return { ...task.state, name: meta.label, color: meta.color, category: meta.value };
            })();
      queryClient.setQueryData<Paginated<Task>>(listKey, (page) =>
        page && { ...page, results: page.results.map((t) => (t.id === task.id ? { ...t, state, position } : t)) },
      );
      return { previous };
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<Paginated<Task>>(listKey, (page) =>
        page && { ...page, results: page.results.map((t) => (t.id === updated.id ? updated : t)) },
      );
      queryClient.setQueryData(taskKeys.detail(org.id, updated.id), updated);
    },
    onError: (error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(listKey, context.previous);
      toast.error("Couldn't move the task", errorMessage(error));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.all(org.id) });
    },
  });

  const contributable = useMemo(
    () => (projects.data ?? []).filter((p) => canContribute(spaces.find((s) => s.id === p.space))),
    [projects.data, spaces, canContribute],
  );
  const [newTask, setNewTask] = useState<NewTaskDefaults | null>(null);

  const openTaskId = params.get("task") ? Number(params.get("task")) : null;
  const openTask = tasks.data?.results.find((t) => t.id === openTaskId);
  const activeFilters = ["project", "assignee", "priority", "tag", "due", "q"].filter((k) => params.get(k));

  if (noSpaceAssigned) return <NoSpaceNotice />;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Task Board"
        description={space ? `${space.name} · drag cards between columns to update their status` : "All spaces, grouped by status"}
        actions={
          contributable.length > 0 && (
            <Button size="sm" onClick={() => setNewTask({})}>
              <Plus className="h-4 w-4" aria-hidden /> New task
            </Button>
          )
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2" role="search" aria-label="Filter tasks">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-subtle" aria-hidden />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks"
            aria-label="Search tasks"
            className={cn(controlClass, "h-8 w-48 border-border pl-8 text-[13px]")}
          />
        </div>
        <select aria-label="Project" value={params.get("project") ?? ""} onChange={(e) => set({ project: e.target.value })} className={filterClass}>
          <option value="">All projects</option>
          {(projects.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.short_code} · {p.name}
            </option>
          ))}
        </select>
        <select aria-label="Assignee" value={params.get("assignee") ?? ""} onChange={(e) => set({ assignee: e.target.value })} className={filterClass}>
          <option value="">Anyone</option>
          <option value="me">Assigned to me</option>
          <option value="none">Unassigned</option>
          {(participants.data ?? [])
            .filter((u) => u.id !== user?.id)
            .map((u) => (
              <option key={u.id} value={u.id}>
                {u.display_name}
              </option>
            ))}
        </select>
        <select aria-label="Priority" value={params.get("priority") ?? ""} onChange={(e) => set({ priority: e.target.value })} className={filterClass}>
          <option value="">Any priority</option>
          {PRIORITIES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        {spaceId !== null && (
          <select aria-label="Tag" value={params.get("tag") ?? ""} onChange={(e) => set({ tag: e.target.value })} className={filterClass}>
            <option value="">Any tag</option>
            {(tags.data ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                #{t.name}
              </option>
            ))}
          </select>
        )}
        <select aria-label="Due date" value={params.get("due") ?? ""} onChange={(e) => set({ due: e.target.value })} className={filterClass}>
          <option value="">Any due date</option>
          <option value="overdue">Overdue</option>
          <option value="week">Due in 7 days</option>
          <option value="none">No due date</option>
        </select>
        {activeFilters.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              set(Object.fromEntries(activeFilters.map((k) => [k, null])));
            }}
          >
            <X className="h-3.5 w-3.5" aria-hidden /> Clear filters
          </Button>
        )}
      </div>

      {tasks.data && tasks.data.count > tasks.data.results.length && (
        <Alert tone="info" className="mb-4">
          Showing the first {tasks.data.results.length} of {tasks.data.count} tasks. Narrow the board with a filter to see the rest.
        </Alert>
      )}

      {tasks.isError ? (
        <ErrorState error={tasks.error} onRetry={() => void tasks.refetch()} />
      ) : tasks.isPending || (spaceId !== null && states.isPending) ? (
        <BoardSkeleton />
      ) : projects.data?.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Tasks live in projects. Create a project in this space to start planning work."
          action={
            <Link href="/projects" className="text-sm font-medium text-primary hover:underline">
              Go to projects
            </Link>
          }
        />
      ) : tasks.data.count === 0 && activeFilters.length === 0 ? (
        <EmptyState
          icon={SquareKanban}
          title="No tasks yet"
          description="Create the first task and drag it across the board as work moves along."
          action={
            contributable.length > 0 && (
              <Button size="sm" onClick={() => setNewTask({})}>
                <Plus className="h-4 w-4" aria-hidden /> New task
              </Button>
            )
          }
        />
      ) : (
        <Board
          columns={columns}
          tasks={tasks.data.results}
          showState={spaceId === null}
          onOpen={(task) => set({ task: String(task.id) })}
          onMove={(task, column, afterId, beforeId) => move.mutate({ task, column, afterId, beforeId })}
          onQuickAdd={
            contributable.length > 0
              ? (column) =>
                  setNewTask(
                    "state_id" in column.target
                      ? { stateId: column.target.state_id, projectId: filters.project }
                      : { category: column.target.category, projectId: filters.project },
                  )
              : undefined
          }
        />
      )}

      <NewTaskDialog
        open={newTask !== null}
        onClose={() => setNewTask(null)}
        projects={contributable}
        defaults={newTask ?? undefined}
      />
      <TaskDrawer taskId={openTaskId} initial={openTask} onClose={() => set({ task: null })} />
    </div>
  );
}

export default function TasksPage() {
  return (
    <Suspense fallback={<BoardSkeleton />}>
      <TaskBoard />
    </Suspense>
  );
}
