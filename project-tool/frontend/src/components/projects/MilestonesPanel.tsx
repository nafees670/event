"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, CalendarClock, Check, ChevronDown, Hand, Milestone as MilestoneIcon, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dialog } from "@/components/ui/Dialog";
import { TextAreaField, TextField } from "@/components/ui/Field";
import { Menu } from "@/components/ui/Menu";
import { ProgressBar } from "@/components/ui/ProgressRing";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { ApiError, errorMessage } from "@/lib/api/client";
import { projectKeys, projectsApi } from "@/lib/api/projects";
import type { Milestone, MilestoneStatus, Project } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDay, timeAgo } from "@/lib/tasks";
import { useCurrentOrg } from "@/lib/workspace-context";

const STATUS: Record<MilestoneStatus, { label: string; tone: "slate" | "amber" | "emerald" }> = {
  NOT_STARTED: { label: "Not started", tone: "slate" },
  IN_PROGRESS: { label: "In progress", tone: "amber" },
  COMPLETED: { label: "Completed", tone: "emerald" },
};

function MilestoneDialog({
  open,
  onClose,
  project,
  milestone,
  available,
}: {
  open: boolean;
  onClose: () => void;
  project: Project;
  milestone?: Milestone;
  /** Weight still free in the project, including this milestone's own share when editing. */
  available: number;
}) {
  const org = useCurrentOrg();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [weight, setWeight] = useState("0");
  const [dueDate, setDueDate] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setName(milestone?.name ?? "");
    setDescription(milestone?.description ?? "");
    setWeight(String(milestone?.weight ?? Math.min(available, 25)));
    setDueDate(milestone?.due_date ?? "");
    setErrors({});
  }, [open, milestone, available]);

  const save = useMutation({
    mutationFn: () => {
      const data = { name: name.trim(), description, weight: Number(weight), due_date: dueDate || null };
      return milestone
        ? projectsApi.updateMilestone(org.id, project.id, milestone.id, data)
        : projectsApi.createMilestone(org.id, project.id, data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.all(org.id) });
      toast.success(milestone ? "Milestone updated" : "Milestone added");
      onClose();
    },
    onError: (error) => {
      if (error instanceof ApiError && (error.fieldError("weight") || error.fieldError("name"))) {
        setErrors({ weight: error.fieldError("weight") ?? "", name: error.fieldError("name") ?? "" });
        return;
      }
      toast.error("Couldn't save the milestone", errorMessage(error));
    },
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    const value = Number(weight);
    if (!name.trim()) next.name = "Enter a name.";
    if (!Number.isInteger(value) || value < 0) next.weight = "Enter a whole number from 0 to 100.";
    else if (value > available) next.weight = `Only ${available}% is left in this project.`;
    setErrors(next);
    if (!Object.keys(next).length) save.mutate();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={milestone ? "Edit milestone" : "New milestone"}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" type="submit" form="milestone-form" loading={save.isPending}>
            Save
          </Button>
        </>
      }
    >
      <form id="milestone-form" onSubmit={submit} className="space-y-4" noValidate>
        <TextField label="Name" data-autofocus value={name} onChange={(e) => setName(e.target.value)} error={errors.name || undefined} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Weight (%)"
            type="number"
            min={0}
            max={available}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            error={errors.weight || undefined}
            hint={`${available}% available`}
          />
          <TextField label="Due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <TextAreaField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
      </form>
    </Dialog>
  );
}

function StatusControl({ project, milestone }: { project: Project; milestone: Milestone }) {
  const org = useCurrentOrg();
  const queryClient = useQueryClient();
  const toast = useToast();
  const status = STATUS[milestone.status];
  const done = () => void queryClient.invalidateQueries({ queryKey: projectKeys.all(org.id) });
  const override = useMutation({
    mutationFn: (next: MilestoneStatus) => projectsApi.overrideMilestone(org.id, project.id, milestone.id, next),
    onSuccess: (_, next) => {
      done();
      toast.success(`Status set to ${STATUS[next].label.toLowerCase()}`, "It stays until you switch back to automatic.");
    },
    onError: (error) => toast.error("Couldn't change the status", errorMessage(error)),
  });
  const reset = useMutation({
    mutationFn: () => projectsApi.resetMilestone(org.id, project.id, milestone.id),
    onSuccess: () => {
      done();
      toast.success("Status is automatic again");
    },
    onError: (error) => toast.error("Couldn't reset the status", errorMessage(error)),
  });
  const manual = milestone.status_overridden && (
    <span
      className="inline-flex items-center gap-1 text-[11px] text-muted"
      title={`Set by ${milestone.overridden_by?.display_name ?? "someone"}${milestone.overridden_at ? ` ${timeAgo(milestone.overridden_at)}` : ""}`}
    >
      <Hand className="h-3 w-3" aria-hidden /> Manual
    </span>
  );

  if (!project.can_manage) {
    return (
      <span className="flex items-center gap-1.5">
        <Badge tone={status.tone}>{status.label}</Badge>
        {manual}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5">
      <Menu
        label={`Status of ${milestone.name}`}
        header={
          milestone.status_overridden
            ? "Set by hand. Tasks no longer change it."
            : "Follows its tasks. Choosing a status pins it."
        }
        items={[
          ...(Object.keys(STATUS) as MilestoneStatus[]).map((value) => ({
            key: value,
            active: milestone.status_overridden && milestone.status === value,
            label: (
              <>
                <span className="flex-1">{STATUS[value].label}</span>
                {milestone.status === value && <Check className="h-3.5 w-3.5 text-primary" aria-hidden />}
              </>
            ),
            onSelect: () => override.mutate(value),
          })),
          ...(milestone.status_overridden
            ? [
                {
                  key: "reset",
                  label: (
                    <>
                      <RotateCcw className="h-3.5 w-3.5 text-subtle" aria-hidden /> Back to automatic
                    </>
                  ),
                  onSelect: () => reset.mutate(),
                },
              ]
            : []),
        ]}
        trigger={
          <>
            <Badge tone={status.tone}>{status.label}</Badge>
            <ChevronDown className="h-3 w-3 text-subtle" aria-hidden />
          </>
        }
      />
      {manual}
    </span>
  );
}

export function MilestonesPanel({ project }: { project: Project }) {
  const org = useCurrentOrg();
  const queryClient = useQueryClient();
  const toast = useToast();
  const milestones = useQuery({
    queryKey: projectKeys.milestones(org.id, project.id),
    queryFn: () => projectsApi.milestones(org.id, project.id),
  });
  const [editing, setEditing] = useState<Milestone | "new" | null>(null);
  const [deleting, setDeleting] = useState<Milestone | null>(null);

  const refresh = () => void queryClient.invalidateQueries({ queryKey: projectKeys.all(org.id) });
  const remove = useMutation({
    mutationFn: (id: number) => projectsApi.deleteMilestone(org.id, project.id, id),
    onSuccess: () => {
      setDeleting(null);
      refresh();
      toast.success("Milestone deleted");
    },
    onError: (error) => toast.error("Couldn't delete", errorMessage(error)),
  });
  const reorder = useMutation({
    mutationFn: (ids: number[]) => projectsApi.reorderMilestones(org.id, project.id, ids),
    onSuccess: refresh,
    onError: (error) => toast.error("Couldn't reorder", errorMessage(error)),
  });

  if (milestones.isPending) return <ListSkeleton rows={3} label="Loading milestones" />;
  if (milestones.isError) return <ErrorState error={milestones.error} onRetry={() => void milestones.refetch()} />;

  const list = milestones.data;
  const total = list.reduce((sum, m) => sum + m.weight, 0);
  const available = 100 - total + (editing && editing !== "new" ? editing.weight : 0);
  const move = (index: number, delta: number) => {
    const ids = list.map((m) => m.id);
    const [id] = ids.splice(index, 1);
    ids.splice(index + delta, 0, id!);
    reorder.mutate(ids);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-56 flex-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted">Weight allocated</span>
            <span className={cn("font-medium", total === 100 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
              {total}% / 100%
            </span>
          </div>
          <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-surface-3" aria-hidden>
            {list.map((m, i) => (
              <div
                key={m.id}
                className="h-full border-r border-surface last:border-r-0"
                style={{ width: `${m.weight}%`, backgroundColor: `hsl(${(i * 47 + 230) % 360} 70% 60%)` }}
                title={`${m.name}: ${m.weight}%`}
              />
            ))}
          </div>
        </div>
        {project.can_manage && (
          <Button size="sm" onClick={() => setEditing("new")} disabled={total >= 100}>
            <Plus className="h-4 w-4" aria-hidden /> Add milestone
          </Button>
        )}
      </div>

      {list.length > 0 && total < 100 && (
        <Alert tone="info">
          Milestone weights add up to {total}%. Allocate the remaining {100 - total}% so project progress can reach 100%.
        </Alert>
      )}

      {list.length === 0 ? (
        <EmptyState
          icon={MilestoneIcon}
          title="No milestones yet"
          description="Split the project into milestones and give each a share (weight) of the whole. Weights should total 100%."
        />
      ) : (
        <ol className="divide-y divide-border rounded-xl border border-border bg-surface">
          {list.map((m, i) => {
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <span className="w-10 shrink-0 text-right font-mono text-sm font-semibold text-fg">{m.weight}%</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-fg">{m.name}</p>
                    <StatusControl project={project} milestone={m} />
                  </div>
                  <ProgressBar value={m.progress} label={`${m.name} progress`} className="mt-2 max-w-sm" />
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-3 text-xs text-muted">
                    <span>
                      {m.completed_task_count}/{m.task_count} tasks done · {Math.round(m.progress)}%
                    </span>
                    {m.due_date && (
                      <span className="flex items-center gap-1">
                        <CalendarClock className="h-3 w-3" aria-hidden /> {formatDay(m.due_date)}
                      </span>
                    )}
                  </p>
                </div>
                {project.can_manage && (
                  <div className="flex items-center gap-0.5">
                    <Button variant="ghost" size="icon" aria-label={`Move ${m.name} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Move ${m.name} down`}
                      disabled={i === list.length - 1}
                      onClick={() => move(i, 1)}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label={`Edit ${m.name}`} onClick={() => setEditing(m)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label={`Delete ${m.name}`} onClick={() => setDeleting(m)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      <MilestoneDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        project={project}
        milestone={editing && editing !== "new" ? editing : undefined}
        available={available}
      />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        loading={remove.isPending}
        title={`Delete “${deleting?.name}”?`}
      >
        Its tasks stay in the project without a milestone.
      </ConfirmDialog>
    </div>
  );
}
