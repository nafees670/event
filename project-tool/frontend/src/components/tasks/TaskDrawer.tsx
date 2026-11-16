"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Drawer } from "@/components/ui/Drawer";
import { controlClass } from "@/components/ui/Field";
import { Picker } from "@/components/ui/Picker";
import { ErrorState, Skeleton } from "@/components/ui/States";
import { TabPanel, Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/api/client";
import { projectKeys, projectsApi } from "@/lib/api/projects";
import { spaceKeys, spacesApi } from "@/lib/api/spaces";
import { taskKeys, tasksApi, type TaskPayload } from "@/lib/api/tasks";
import type { CustomField, CustomFieldValue, Priority, Task, UserSummary } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { useParticipants, usePermissions, useSpaceFields, useSpaceStates, useSpaceTags } from "@/lib/hooks/useSpaceData";
import { PRIORITIES, SWATCHES, timeAgo } from "@/lib/tasks";
import { useCurrentOrg, useWorkspace } from "@/lib/workspace-context";

import { StateDot, TagPill } from "./bits";
import { ActivityPanel, CommentsPanel, FilesPanel } from "./TaskPanels";

type Update = Partial<Omit<TaskPayload, "project">>;

const inlineControl = cn(controlClass, "h-8 border-transparent bg-transparent shadow-none hover:border-border");

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] items-center gap-2 py-0.5">
      <span className="text-[13px] text-muted">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function CustomFieldInput({
  field,
  value,
  participants,
  disabled,
  onSave,
}: {
  field: CustomField;
  value: CustomFieldValue | undefined;
  participants: UserSummary[];
  disabled: boolean;
  onSave: (value: CustomFieldValue | null) => void;
}) {
  const [draft, setDraft] = useState(value === undefined ? "" : String(value));
  useEffect(() => setDraft(value === undefined ? "" : String(value)), [value]);
  const commit = (next: string) => {
    if (next === (value === undefined ? "" : String(value))) return;
    onSave(next === "" ? null : field.field_type === "user" ? Number(next) : next);
  };

  if (field.field_type === "select" || field.field_type === "user") {
    const options =
      field.field_type === "select"
        ? field.options.map((o) => ({ value: o, label: o }))
        : participants.map((u) => ({ value: String(u.id), label: u.display_name }));
    return (
      <select
        aria-label={field.name}
        disabled={disabled}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          commit(e.target.value);
        }}
        className={inlineControl}
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      aria-label={field.name}
      disabled={disabled}
      type={field.field_type === "number" ? "number" : field.field_type === "date" ? "date" : "text"}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        if (field.field_type === "date") commit(e.target.value);
      }}
      onBlur={(e) => field.field_type !== "date" && commit(e.target.value.trim())}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      placeholder="—"
      className={inlineControl}
    />
  );
}

function TaskBody({ task, onDeleted }: { task: Task; onDeleted: () => void }) {
  const org = useCurrentOrg();
  const { spaces, user } = useWorkspace();
  const { canContribute, canManage } = usePermissions();
  const queryClient = useQueryClient();
  const toast = useToast();
  const space = spaces.find((s) => s.id === task.space);
  const editable = task.can_edit;

  const states = useSpaceStates(task.space);
  const tags = useSpaceTags(task.space);
  const fields = useSpaceFields(task.space);
  const participants = useParticipants(task.space);
  const milestones = useQuery({
    queryKey: projectKeys.milestones(org.id, task.project.id),
    queryFn: () => projectsApi.milestones(org.id, task.project.id),
  });

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [tab, setTab] = useState<"comments" | "files" | "activity">("comments");
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => setTitle(task.title), [task.title]);
  useEffect(() => setDescription(task.description), [task.description]);

  const syncTask = (updated: Task) => {
    queryClient.setQueryData(taskKeys.detail(org.id, updated.id), updated);
    void queryClient.invalidateQueries({ queryKey: [...taskKeys.all(org.id), "list"] });
    void queryClient.invalidateQueries({ queryKey: taskKeys.activity(org.id, updated.id) });
    void queryClient.invalidateQueries({ queryKey: projectKeys.all(org.id) });
  };

  const update = useMutation({
    mutationFn: (data: Update) => tasksApi.update(org.id, task.id, data),
    onSuccess: syncTask,
    onError: (error) => {
      toast.error("Couldn't save", errorMessage(error));
      setTitle(task.title);
      setDescription(task.description);
    },
  });
  const remove = useMutation({
    mutationFn: () => tasksApi.remove(org.id, task.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: taskKeys.all(org.id) });
      void queryClient.invalidateQueries({ queryKey: projectKeys.all(org.id) });
      toast.success(`${task.key} deleted`);
      onDeleted();
    },
    onError: (error) => toast.error("Couldn't delete", errorMessage(error)),
  });
  const createTag = useMutation({
    mutationFn: (name: string) => spacesApi.createTag(org.id, task.space, { name, color: SWATCHES[name.length % SWATCHES.length]! }),
    onSuccess: (tag) => {
      void queryClient.invalidateQueries({ queryKey: spaceKeys.tags(org.id, task.space) });
      update.mutate({ tag_ids: [...task.tags.map((t) => t.id), tag.id] });
    },
    onError: (error) => toast.error("Couldn't create the tag", errorMessage(error)),
  });

  const saveCustom = (fieldId: number, value: CustomFieldValue | null) => {
    const next: Record<string, CustomFieldValue | null> = { ...task.custom_fields };
    if (value === null) delete next[String(fieldId)];
    else next[String(fieldId)] = value;
    update.mutate({ custom_fields: next });
  };

  // Mirrors the API: managers, or the task's creator while they can still contribute to the space.
  const canDelete = canManage(space) || (task.created_by?.id === user?.id && canContribute(space));

  return (
    <div className="space-y-6 p-5 sm:p-6">
      <div className="space-y-2">
        <textarea
          aria-label="Title"
          value={title}
          disabled={!editable}
          rows={1}
          onChange={(e) => setTitle(e.target.value.replace(/\n/g, " "))}
          onBlur={() => {
            const next = title.trim();
            if (next && next !== task.title) update.mutate({ title: next });
            else setTitle(task.title);
          }}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), (e.target as HTMLTextAreaElement).blur())}
          className="w-full resize-none rounded-lg bg-transparent px-1 text-xl leading-snug font-semibold text-fg [field-sizing:content] hover:bg-surface-2/60 focus:bg-surface-2/60 focus:outline-none disabled:hover:bg-transparent"
        />
        <p className="px-1 text-xs text-subtle">
          Created by {task.created_by?.display_name ?? "a former member"} {timeAgo(task.created_at)}
          {!editable && " · read only"}
        </p>
      </div>

      <div className="rounded-xl border border-border p-3">
        <Row label="Status">
          <div className="flex items-center gap-2">
            <StateDot color={task.state.color} className="ml-2" />
            <select
              aria-label="Status"
              disabled={!editable}
              value={task.state.id}
              onChange={(e) => update.mutate({ state_id: Number(e.target.value) })}
              className={inlineControl}
            >
              {(states.data ?? [task.state]).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </Row>
        <Row label="Priority">
          <select
            aria-label="Priority"
            disabled={!editable}
            value={task.priority}
            onChange={(e) => update.mutate({ priority: e.target.value as Priority })}
            className={inlineControl}
          >
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </Row>
        <Row label="Assignees">
          <Picker
            label="Assignees"
            disabled={!editable}
            selected={task.assignees.map((a) => a.id)}
            onChange={(ids) => update.mutate({ assignee_ids: ids })}
            options={(participants.data ?? []).map((u) => ({ value: u.id, label: u.display_name, prefix: <Avatar user={u} size="sm" /> }))}
            trigger={
              task.assignees.length ? (
                task.assignees.map((u) => (
                  <span key={u.id} className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 py-0.5 pr-2 pl-0.5 text-xs">
                    <Avatar user={u} size="sm" />
                    {u.display_name}
                  </span>
                ))
              ) : (
                <span className="text-subtle">Unassigned</span>
              )
            }
          />
        </Row>
        <Row label="Tags">
          <Picker
            label="Tags"
            disabled={!editable}
            selected={task.tags.map((t) => t.id)}
            onChange={(ids) => update.mutate({ tag_ids: ids })}
            onCreate={canContribute(space) ? (name) => createTag.mutate(name) : undefined}
            createLabel="Create tag"
            options={(tags.data ?? []).map((t) => ({
              value: t.id,
              label: t.name,
              prefix: <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} aria-hidden />,
            }))}
            trigger={
              task.tags.length ? task.tags.map((t) => <TagPill key={t.id} tag={t} />) : <span className="text-subtle">No tags</span>
            }
          />
        </Row>
        <Row label="Milestone">
          <select
            aria-label="Milestone"
            disabled={!editable}
            value={task.milestone?.id ?? ""}
            onChange={(e) => update.mutate({ milestone_id: e.target.value ? Number(e.target.value) : null })}
            className={inlineControl}
          >
            <option value="">None</option>
            {(milestones.data ?? (task.milestone ? [task.milestone] : [])).map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Row>
        <Row label="Start date">
          <input
            type="date"
            aria-label="Start date"
            disabled={!editable}
            value={task.start_date ?? ""}
            onChange={(e) => update.mutate({ start_date: e.target.value || null })}
            className={inlineControl}
          />
        </Row>
        <Row label="Due date">
          <input
            type="date"
            aria-label="Due date"
            disabled={!editable}
            value={task.due_date ?? ""}
            onChange={(e) => update.mutate({ due_date: e.target.value || null })}
            className={inlineControl}
          />
        </Row>
        {(fields.data ?? []).map((field) => (
          <Row key={field.id} label={field.required ? `${field.name} *` : field.name}>
            <CustomFieldInput
              field={field}
              value={task.custom_fields[String(field.id)]}
              participants={participants.data ?? []}
              disabled={!editable}
              onSave={(value) => saveCustom(field.id, value)}
            />
          </Row>
        ))}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="task-description" className="text-[13px] font-medium text-fg">
          Description
        </label>
        <textarea
          id="task-description"
          value={description}
          disabled={!editable}
          rows={5}
          placeholder={editable ? "Add details, acceptance criteria, links…" : "No description."}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => description !== task.description && update.mutate({ description })}
          className={cn(controlClass, "border-border py-2 leading-relaxed")}
        />
      </div>

      <div>
        <Tabs
          idPrefix="task"
          label="Task details"
          value={tab}
          onChange={setTab}
          items={[
            { value: "comments", label: "Comments", count: task.comment_count },
            { value: "files", label: "Files", count: task.attachment_count },
            { value: "activity", label: "Activity" },
          ]}
        />
        <TabPanel idPrefix="task" value={tab}>
          {tab === "comments" && <CommentsPanel task={task} canComment={canContribute(space)} />}
          {tab === "files" && <FilesPanel task={task} canUpload={canContribute(space)} />}
          {tab === "activity" && <ActivityPanel task={task} />}
        </TabPanel>
      </div>

      {canDelete && (
        <div className="border-t border-border pt-4">
          <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-600" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete task
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => remove.mutate()}
        loading={remove.isPending}
        title={`Delete ${task.key}?`}
      >
        The task, its comments and files will be removed. This can&apos;t be undone.
      </ConfirmDialog>
    </div>
  );
}

/** Side panel for one task. ``initial`` (from the board) renders instantly while the full task loads. */
export function TaskDrawer({ taskId, initial, onClose }: { taskId: number | null; initial?: Task; onClose: () => void }) {
  const org = useCurrentOrg();
  const task = useQuery({
    queryKey: taskKeys.detail(org.id, taskId ?? 0),
    queryFn: () => tasksApi.get(org.id, taskId!),
    enabled: taskId !== null,
    placeholderData: initial,
  });
  const data = task.data;

  return (
    <Drawer
      open={taskId !== null}
      onClose={onClose}
      label={data ? `${data.key} ${data.title}` : "Task"}
      header={
        data && (
          <>
            <span className="font-mono text-[13px] font-medium text-muted">{data.key}</span>
            <Link
              href={`/projects/${data.project.id}`}
              className="inline-flex min-w-0 items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-[13px] text-muted hover:bg-surface-2 hover:text-fg"
            >
              <span className="truncate">{data.project.name}</span>
              <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
            </Link>
          </>
        )
      }
    >
      {data ? (
        <TaskBody key={data.id} task={data} onDeleted={onClose} />
      ) : task.isError ? (
        <div className="p-6">
          <ErrorState error={task.error} onRetry={() => void task.refetch()} />
        </div>
      ) : (
        <div role="status" aria-label="Loading task" className="space-y-4 p-6">
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}
    </Drawer>
  );
}
