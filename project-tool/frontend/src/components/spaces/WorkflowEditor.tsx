"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { StateDot } from "@/components/tasks/bits";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { ColorField, SelectField, TextField } from "@/components/ui/Field";
import { ErrorState, ListSkeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { ApiError, errorMessage } from "@/lib/api/client";
import { spaceKeys, spacesApi } from "@/lib/api/spaces";
import { taskKeys } from "@/lib/api/tasks";
import type { Space, StateCategory, WorkflowState } from "@/lib/api/types";
import { useSpaceStates } from "@/lib/hooks/useSpaceData";
import { CATEGORIES, SWATCHES, categoryMeta } from "@/lib/tasks";
import { useCurrentOrg } from "@/lib/workspace-context";

const STATE_COLORS = [...new Set([...CATEGORIES.map((c) => c.color), ...SWATCHES])];

function StateDialog({ open, onClose, space, state }: { open: boolean; onClose: () => void; space: Space; state?: WorkflowState }) {
  const org = useCurrentOrg();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<StateCategory>("STARTED");
  const [color, setColor] = useState(STATE_COLORS[0]!);
  const [isDefault, setIsDefault] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    setName(state?.name ?? "");
    setCategory(state?.category ?? "STARTED");
    setColor(state?.color ?? categoryMeta("STARTED").color);
    setIsDefault(state?.is_default ?? false);
    setError(undefined);
  }, [open, state]);

  const save = useMutation({
    mutationFn: () => {
      const data = { name: name.trim(), category, color, ...(isDefault ? { is_default: true } : {}) };
      return state ? spacesApi.updateState(org.id, space.id, state.id, data) : spacesApi.createState(org.id, space.id, data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: spaceKeys.states(org.id, space.id) });
      void queryClient.invalidateQueries({ queryKey: taskKeys.all(org.id) });
      toast.success(state ? "State updated" : "State added");
      onClose();
    },
    onError: (err) => {
      const field = err instanceof ApiError ? err.fieldError("name") : undefined;
      if (field) setError(field);
      else toast.error("Couldn't save the state", errorMessage(err));
    },
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={state ? `Edit “${state.name}”` : "New workflow state"}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" type="submit" form="state-form" loading={save.isPending}>
            Save
          </Button>
        </>
      }
    >
      <form
        id="state-form"
        className="space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) setError("Enter a name.");
          else save.mutate();
        }}
      >
        <TextField label="Name" data-autofocus value={name} onChange={(e) => setName(e.target.value)} error={error} />
        <SelectField
          label="Group"
          value={category}
          onChange={(e) => setCategory(e.target.value as StateCategory)}
          hint="Progress and analytics use the group, so a renamed state still counts correctly."
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.value === "UNSTARTED" ? "Not started" : c.label}
            </option>
          ))}
        </SelectField>
        <ColorField label="Color" value={color} onChange={setColor} colors={STATE_COLORS} />
        {!state?.is_default && (
          <label className="flex items-center gap-2 text-[13px] text-fg">
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
            New tasks start in this state
          </label>
        )}
      </form>
    </Dialog>
  );
}

function DeleteStateDialog({
  state,
  states,
  space,
  onClose,
}: {
  state: WorkflowState | null;
  states: WorkflowState[];
  space: Space;
  onClose: () => void;
}) {
  const org = useCurrentOrg();
  const queryClient = useQueryClient();
  const toast = useToast();
  const others = states.filter((s) => s.id !== state?.id);
  // Remounted per state (see ``key`` below), so the default target is computed once.
  const [moveTo, setMoveTo] = useState<number | "">(
    () => others.find((s) => s.category === state?.category)?.id ?? others[0]?.id ?? "",
  );

  const remove = useMutation({
    mutationFn: () => spacesApi.deleteState(org.id, space.id, state!.id, state!.task_count ? Number(moveTo) : undefined),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: spaceKeys.states(org.id, space.id) });
      void queryClient.invalidateQueries({ queryKey: taskKeys.all(org.id) });
      toast.success("State deleted");
      onClose();
    },
    onError: (err) => toast.error("Couldn't delete the state", errorMessage(err)),
  });

  return (
    <Dialog
      open={state !== null}
      onClose={onClose}
      title={`Delete “${state?.name}”?`}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" loading={remove.isPending} onClick={() => remove.mutate()}>
            Delete state
          </Button>
        </>
      }
    >
      {state && state.task_count > 0 ? (
        <div className="space-y-3">
          <p>
            {state.task_count} {state.task_count === 1 ? "task is" : "tasks are"} in this state. Move them to:
          </p>
          <SelectField label="Move tasks to" value={moveTo} onChange={(e) => setMoveTo(Number(e.target.value))}>
            {others.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </SelectField>
        </div>
      ) : (
        <p>No tasks use this state.</p>
      )}
    </Dialog>
  );
}

export function WorkflowEditor({ space, canEdit }: { space: Space; canEdit: boolean }) {
  const org = useCurrentOrg();
  const queryClient = useQueryClient();
  const toast = useToast();
  const states = useSpaceStates(space.id);
  const [editing, setEditing] = useState<WorkflowState | "new" | null>(null);
  const [deleting, setDeleting] = useState<WorkflowState | null>(null);

  const reorder = useMutation({
    mutationFn: (ids: number[]) => spacesApi.reorderStates(org.id, space.id, ids),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: spaceKeys.states(org.id, space.id) });
    },
    onError: (err) => toast.error("Couldn't reorder", errorMessage(err)),
  });

  if (states.isPending) return <ListSkeleton rows={5} label="Loading workflow" />;
  if (states.isError) return <ErrorState error={states.error} onRetry={() => void states.refetch()} />;

  const list = states.data;
  const move = (index: number, delta: number) => {
    const ids = list.map((s) => s.id);
    const [id] = ids.splice(index, 1);
    ids.splice(index + delta, 0, id!);
    reorder.mutate(ids);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-[13px] text-muted">
          These are the columns of the {space.name} task board, in order. Each state belongs to a group that progress and
          analytics understand.
        </p>
        {canEdit && (
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" aria-hidden /> Add state
          </Button>
        )}
      </div>
      <ol className="divide-y divide-border rounded-xl border border-border bg-surface">
        {list.map((state, i) => (
          <li key={state.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
            <StateDot color={state.color} />
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-fg">{state.name}</span>
            {state.is_default && <Badge tone="indigo">Default</Badge>}
            <Badge>{state.category === "UNSTARTED" ? "Not started" : categoryMeta(state.category).label}</Badge>
            <span className="w-16 text-right text-xs text-muted">{state.task_count} tasks</span>
            {canEdit && (
              <span className="flex gap-0.5">
                <Button variant="ghost" size="icon" aria-label={`Move ${state.name} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Move ${state.name} down`}
                  disabled={i === list.length - 1}
                  onClick={() => move(i, 1)}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" aria-label={`Edit ${state.name}`} onClick={() => setEditing(state)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${state.name}`}
                  disabled={list.length <= 1}
                  onClick={() => setDeleting(state)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </span>
            )}
          </li>
        ))}
      </ol>
      <StateDialog open={editing !== null} onClose={() => setEditing(null)} space={space} state={editing === "new" ? undefined : (editing ?? undefined)} />
      <DeleteStateDialog key={deleting?.id ?? "none"} state={deleting} states={list} space={space} onClose={() => setDeleting(null)} />
    </div>
  );
}
