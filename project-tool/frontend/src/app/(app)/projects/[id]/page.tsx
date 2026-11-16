"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, FileText, GitBranch, HardDrive, ListTodo, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState, type ReactNode } from "react";

import { MilestonesPanel } from "@/components/projects/MilestonesPanel";
import { ProjectFormDialog } from "@/components/projects/ProjectFormDialog";
import { ProjectProgress } from "@/components/projects/ProjectProgress";
import { DueDate, PriorityIcon, StateDot } from "@/components/tasks/bits";
import { NewTaskDialog } from "@/components/tasks/NewTaskDialog";
import { TaskDrawer } from "@/components/tasks/TaskDrawer";
import { Avatar, AvatarStack } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { controlClass } from "@/components/ui/Field";
import { Card } from "@/components/ui/PageHeader";
import { EmptyState, ErrorState, LoadingState, Skeleton } from "@/components/ui/States";
import { TabPanel, Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/api/client";
import { projectKeys, projectsApi } from "@/lib/api/projects";
import { taskKeys, tasksApi } from "@/lib/api/tasks";
import type { Project, StateCategory, Task, UserSummary } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { usePermissions } from "@/lib/hooks/useSpaceData";
import { CATEGORIES, formatDay, projectStatusMeta } from "@/lib/tasks";
import { useCurrentOrg, useWorkspace } from "@/lib/workspace-context";

type Tab = "overview" | "milestones" | "tasks";
const TABS: Tab[] = ["overview", "milestones", "tasks"];

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 text-[13px] text-fg">{children}</dd>
    </div>
  );
}

function LinkRow({ href, label, icon: Icon }: { href: string; label: string; icon: typeof FileText }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-fg transition-colors hover:bg-surface-2"
    >
      <Icon className="h-4 w-4 text-subtle" aria-hidden />
      <span className="flex-1 truncate">{label}</span>
      <ExternalLink className="h-3.5 w-3.5 text-subtle" aria-hidden />
    </a>
  );
}

function Overview({ project, tasks }: { project: Project; tasks: Task[] | undefined }) {
  // Who is working on what: open tasks per assignee.
  const team = useMemo(() => {
    const counts = new Map<number, { user: UserSummary; open: number; done: number }>();
    for (const task of tasks ?? []) {
      const done = task.state.category === "COMPLETED";
      if (task.state.category === "CANCELLED") continue;
      for (const user of task.assignees) {
        const row = counts.get(user.id) ?? { user, open: 0, done: 0 };
        if (done) row.done += 1;
        else row.open += 1;
        counts.set(user.id, row);
      }
    }
    return [...counts.values()].sort((a, b) => b.open - a.open || a.user.display_name.localeCompare(b.user.display_name));
  }, [tasks]);
  const links = [
    project.repo_url && { href: project.repo_url, label: "Code repository", icon: GitBranch },
    project.docs_url && { href: project.docs_url, label: "Proposal / docs", icon: FileText },
    project.drive_url && { href: project.drive_url, label: "Shared drive", icon: HardDrive },
  ].filter(Boolean) as { href: string; label: string; icon: typeof FileText }[];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-6">
        <Card className="p-5">
          <h2 className="text-[15px] font-semibold text-fg">About</h2>
          <p className="mt-2 text-sm whitespace-pre-wrap text-muted">{project.description || "No description yet."}</p>
          <div className="mt-5">
            <ProjectProgress project={project} size={84} />
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="text-[15px] font-semibold text-fg">Team</h2>
          <p className="mt-0.5 text-[13px] text-muted">People with tasks in this project.</p>
          {tasks === undefined ? (
            <Skeleton className="mt-4 h-16 w-full" />
          ) : team.length === 0 ? (
            <p className="mt-4 text-[13px] text-subtle">Nobody is assigned yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {team.map(({ user, open, done }) => (
                <li key={user.id} className="flex items-center gap-3 py-2.5">
                  <Avatar user={user} />
                  <span className="flex-1 truncate text-[13px] font-medium text-fg">{user.display_name}</span>
                  <span className="text-xs text-muted">
                    {open} open · {done} done
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <div className="space-y-6">
        <Card className="p-5">
          <dl className="grid grid-cols-2 gap-4">
            <Detail label="Status">
              <Badge tone={projectStatusMeta(project.status).tone}>{projectStatusMeta(project.status).label}</Badge>
            </Detail>
            <Detail label="Space">
              <span className="font-mono text-xs">{project.space_code}</span>
            </Detail>
            <Detail label="Lead">
              {project.lead ? (
                <span className="flex items-center gap-1.5">
                  <Avatar user={project.lead} size="sm" /> {project.lead.display_name}
                </span>
              ) : (
                <span className="text-subtle">None</span>
              )}
            </Detail>
            <Detail label="Milestones">
              {project.milestone_count} · {project.milestone_weight_total}% allocated
            </Detail>
            <Detail label="Start">{project.start_date ? formatDay(project.start_date) : "—"}</Detail>
            <Detail label="Target">{project.target_date ? formatDay(project.target_date) : "—"}</Detail>
          </dl>
        </Card>
        <Card className="p-2">
          <h2 className="px-3 pt-2 pb-1 text-[13px] font-semibold text-fg">Links</h2>
          {links.length ? (
            links.map((link) => <LinkRow key={link.label} {...link} />)
          ) : (
            <p className="px-3 pb-2 text-[13px] text-subtle">No links added.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function TaskList({ tasks, onOpen }: { tasks: Task[]; onOpen: (task: Task) => void }) {
  const [category, setCategory] = useState<StateCategory | "open" | "">("open");
  const shown = tasks.filter((t) =>
    category === "open" ? !["COMPLETED", "CANCELLED"].includes(t.state.category) : !category || t.state.category === category,
  );
  return (
    <div className="space-y-4">
      <select
        aria-label="Status group"
        value={category}
        onChange={(e) => setCategory(e.target.value as StateCategory | "open" | "")}
        className={cn(controlClass, "h-8 w-auto border-border pr-8 text-[13px]")}
      >
        <option value="open">Open tasks</option>
        <option value="">All tasks</option>
        {CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
      {shown.length === 0 ? (
        <EmptyState icon={ListTodo} title="No tasks here" />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {shown.map((task) => (
            <li key={task.id}>
              <button
                type="button"
                onClick={() => onOpen(task)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-2/60"
              >
                <PriorityIcon priority={task.priority} />
                <span className="w-20 shrink-0 font-mono text-xs text-subtle">{task.key}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-fg">{task.title}</span>
                <span className="hidden items-center gap-1.5 text-xs text-muted sm:flex">
                  <StateDot color={task.state.color} /> {task.state.name}
                </span>
                {task.due_date && (
                  <span className="hidden md:inline">
                    <DueDate due={task.due_date} done={task.state.category === "COMPLETED"} />
                  </span>
                )}
                <AvatarStack users={task.assignees} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProjectDetail() {
  const org = useCurrentOrg();
  const { spaces } = useWorkspace();
  const { canManage, canContribute } = usePermissions();
  const queryClient = useQueryClient();
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);

  const project = useQuery({ queryKey: projectKeys.detail(org.id, projectId), queryFn: () => projectsApi.get(org.id, projectId) });
  const tasks = useQuery({
    queryKey: taskKeys.list(org.id, { project: projectId }),
    queryFn: () => tasksApi.list(org.id, { project: projectId }),
    select: (page) => page.results,
  });
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  // Stable identity: the dialog resets its form when this changes.
  const taskProjects = useMemo(() => (project.data ? [project.data] : []), [project.data]);

  const tab: Tab = TABS.includes(params.get("tab") as Tab) ? (params.get("tab") as Tab) : "overview";
  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value === null) next.delete(key);
    else next.set(key, value);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };
  const openTaskId = params.get("task") ? Number(params.get("task")) : null;

  const remove = useMutation({
    mutationFn: () => projectsApi.remove(org.id, projectId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.all(org.id) });
      void queryClient.invalidateQueries({ queryKey: taskKeys.all(org.id) });
      toast.success("Project deleted");
      router.push("/projects");
    },
    onError: (error) => toast.error("Couldn't delete the project", errorMessage(error)),
  });

  if (project.isPending) return <LoadingState label="Loading project…" />;
  if (project.isError) {
    return (
      <div className="mx-auto max-w-lg pt-10">
        <ErrorState error={project.error} onRetry={() => void project.refetch()} />
      </div>
    );
  }

  const p = project.data;
  const space = spaces.find((s) => s.id === p.space);
  const managed = spaces.filter((s) => canManage(s));

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/projects" className="mb-4 inline-flex items-center gap-1 text-[13px] text-muted hover:text-fg">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Projects
      </Link>
      <div className="mb-6 flex animate-slide-up flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="mt-0.5 rounded-lg px-2.5 py-1.5 font-mono text-sm font-bold text-white shadow-sm"
            style={{ backgroundColor: space?.color ?? "#64748B" }}
          >
            {p.short_code}
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-fg">{p.name}</h1>
            <p className="mt-1 text-sm text-muted">{space ? `${space.name} space` : p.space_code}</p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          {canContribute(space) && (
            <Button size="sm" onClick={() => setCreatingTask(true)}>
              <Plus className="h-4 w-4" aria-hidden /> New task
            </Button>
          )}
          {p.can_manage && (
            <>
              <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
              </Button>
              <Button variant="secondary" size="icon" aria-label="Delete project" onClick={() => setDeleting(true)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      <Tabs
        idPrefix="project"
        label="Project sections"
        value={tab}
        onChange={(value) => setParam("tab", value === "overview" ? null : value)}
        items={[
          { value: "overview", label: "Overview" },
          { value: "milestones", label: "Milestones", count: p.milestone_count },
          { value: "tasks", label: "Tasks", count: p.task_count },
        ]}
      />
      <TabPanel idPrefix="project" value={tab}>
        {tab === "overview" && <Overview project={p} tasks={tasks.data} />}
        {tab === "milestones" && <MilestonesPanel project={p} />}
        {tab === "tasks" &&
          (tasks.isError ? (
            <ErrorState error={tasks.error} onRetry={() => void tasks.refetch()} />
          ) : tasks.isPending ? (
            <LoadingState label="Loading tasks…" />
          ) : (
            <TaskList tasks={tasks.data} onOpen={(task) => setParam("task", String(task.id))} />
          ))}
      </TabPanel>

      <ProjectFormDialog open={editing} onClose={() => setEditing(false)} project={p} spaces={managed} />
      <NewTaskDialog
        open={creatingTask}
        onClose={() => setCreatingTask(false)}
        projects={taskProjects}
      />
      <TaskDrawer
        taskId={openTaskId}
        initial={tasks.data?.find((t) => t.id === openTaskId)}
        onClose={() => setParam("task", null)}
      />
      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={() => remove.mutate()}
        loading={remove.isPending}
        title={`Delete ${p.short_code}?`}
      >
        All of the project&apos;s milestones, tasks, comments and files will be deleted. This can&apos;t be undone.
      </ConfirmDialog>
    </div>
  );
}

export default function ProjectPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading project…" />}>
      <ProjectDetail />
    </Suspense>
  );
}
