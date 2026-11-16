"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { SelectField, TextField } from "@/components/ui/Field";
import { Picker } from "@/components/ui/Picker";
import { useToast } from "@/components/ui/Toast";
import { ApiError, errorMessage } from "@/lib/api/client";
import { projectKeys } from "@/lib/api/projects";
import { taskKeys, tasksApi } from "@/lib/api/tasks";
import type { Priority, Project, StateCategory, Task } from "@/lib/api/types";
import { useParticipants, useSpaceStates } from "@/lib/hooks/useSpaceData";
import { PRIORITIES } from "@/lib/tasks";
import { useCurrentOrg } from "@/lib/workspace-context";

export interface NewTaskDefaults {
  projectId?: number;
  stateId?: number;
  /** On the cross-space board a column is a category; the project's matching state is used. */
  category?: StateCategory;
}

export function NewTaskDialog({
  open,
  onClose,
  projects,
  defaults,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  /** Projects the user may add tasks to. */
  projects: Project[];
  defaults?: NewTaskDefaults;
  onCreated?: (task: Task) => void;
}) {
  const org = useCurrentOrg();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState<number | "">("");
  const [stateId, setStateId] = useState<number | "">("");
  const [priority, setPriority] = useState<Priority>("NONE");
  const [assignees, setAssignees] = useState<number[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const project = projects.find((p) => p.id === projectId);
  const states = useSpaceStates(project?.space);
  const participants = useParticipants(project?.space);
  const options = useMemo(() => states.data ?? [], [states.data]);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setPriority("NONE");
    setAssignees([]);
    setDueDate("");
    setErrors({});
    setStateId(defaults?.stateId ?? "");
    setProjectId(defaults?.projectId ?? (projects.length === 1 ? projects[0]!.id : ""));
  }, [open, defaults, projects]);

  // Pick the column's state (or category) once the project's workflow is known.
  useEffect(() => {
    if (!options.length) return;
    if (stateId !== "" && options.some((s) => s.id === stateId)) return;
    const byCategory = defaults?.category ? options.find((s) => s.category === defaults.category) : undefined;
    setStateId((byCategory ?? options.find((s) => s.is_default) ?? options[0]!).id);
  }, [options, stateId, defaults]);

  const create = useMutation({
    mutationFn: () =>
      tasksApi.create(org.id, {
        project: Number(projectId),
        title: title.trim(),
        state_id: stateId === "" ? undefined : stateId,
        priority,
        assignee_ids: assignees,
        due_date: dueDate || null,
      }),
    onSuccess: (task) => {
      void queryClient.invalidateQueries({ queryKey: taskKeys.all(org.id) });
      void queryClient.invalidateQueries({ queryKey: projectKeys.all(org.id) });
      toast.success(`${task.key} created`);
      onCreated?.(task);
      onClose();
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        const next: Record<string, string> = {};
        for (const field of ["title", "project", "state_id", "assignee_ids", "due_date", "custom_fields"]) {
          const message = error.fieldError(field);
          if (message) next[field] = message;
        }
        setErrors(next);
        if (Object.keys(next).length) return;
      }
      toast.error("Couldn't create the task", errorMessage(error));
    },
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = "Enter a title.";
    if (projectId === "") next.project = "Pick a project.";
    setErrors(next);
    if (!Object.keys(next).length) create.mutate();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New task"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" type="submit" form="new-task-form" loading={create.isPending}>
            Create task
          </Button>
        </>
      }
    >
      <form id="new-task-form" onSubmit={submit} className="space-y-4" noValidate>
        <TextField
          label="Title"
          data-autofocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={errors.title}
          placeholder="What needs to be done?"
        />
        <SelectField
          label="Project"
          value={projectId}
          onChange={(e) => {
            setProjectId(e.target.value ? Number(e.target.value) : "");
            setStateId(defaults?.stateId ?? "");
            setAssignees([]);
          }}
          error={errors.project}
        >
          <option value="">Choose a project…</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.short_code} · {p.name}
            </option>
          ))}
        </SelectField>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Status"
            value={stateId}
            disabled={!project}
            onChange={(e) => setStateId(Number(e.target.value))}
            error={errors.state_id}
          >
            {options.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </SelectField>
          <SelectField label="Priority" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="space-y-1.5">
          <span className="block text-[13px] font-medium text-fg">Assignees</span>
          <div className="rounded-lg border border-border">
            <Picker
              label="Assignees"
              disabled={!project}
              selected={assignees}
              onChange={setAssignees}
              options={(participants.data ?? []).map((u) => ({
                value: u.id,
                label: u.display_name,
                prefix: <Avatar user={u} size="sm" />,
              }))}
              trigger={
                assignees.length ? (
                  (participants.data ?? [])
                    .filter((u) => assignees.includes(u.id))
                    .map((u) => (
                      <span key={u.id} className="inline-flex items-center gap-1 rounded-full bg-surface-2 py-0.5 pr-2 pl-0.5 text-xs">
                        <Avatar user={u} size="sm" />
                        {u.display_name}
                      </span>
                    ))
                ) : (
                  <span className="text-subtle">{project ? "Unassigned" : "Pick a project first"}</span>
                )
              }
            />
          </div>
          {errors.assignee_ids && <p className="text-[13px] text-red-600">{errors.assignee_ids}</p>}
        </div>
        <TextField label="Due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} error={errors.due_date} />
        {errors.custom_fields && <p className="text-[13px] text-red-600">{errors.custom_fields}</p>}
      </form>
    </Dialog>
  );
}
