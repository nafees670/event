"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileText, History, Pencil, Send, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { controlClass } from "@/components/ui/Field";
import { ErrorState, ListSkeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/api/client";
import { taskKeys, tasksApi } from "@/lib/api/tasks";
import type { Activity, Task } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatBytes, timeAgo } from "@/lib/tasks";
import { useCurrentOrg } from "@/lib/workspace-context";

/** After a comment or file changes, the board's counters must follow. */
function useRefreshTask(taskId: number) {
  const org = useCurrentOrg();
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: taskKeys.activity(org.id, taskId) });
    void queryClient.invalidateQueries({ queryKey: [...taskKeys.all(org.id), "list"] });
  };
}

export function CommentsPanel({ task, canComment }: { task: Task; canComment: boolean }) {
  const org = useCurrentOrg();
  const queryClient = useQueryClient();
  const toast = useToast();
  const refresh = useRefreshTask(task.id);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<{ id: number; body: string } | null>(null);
  const key = taskKeys.comments(org.id, task.id);
  const comments = useQuery({ queryKey: key, queryFn: () => tasksApi.comments(org.id, task.id) });

  const onDone = () => {
    void queryClient.invalidateQueries({ queryKey: key });
    refresh();
  };
  const add = useMutation({
    mutationFn: (body: string) => tasksApi.addComment(org.id, task.id, body),
    onSuccess: () => {
      setDraft("");
      onDone();
    },
    onError: (error) => toast.error("Couldn't post the comment", errorMessage(error)),
  });
  const edit = useMutation({
    mutationFn: ({ id, body }: { id: number; body: string }) => tasksApi.editComment(org.id, task.id, id, body),
    onSuccess: () => {
      setEditing(null);
      onDone();
    },
    onError: (error) => toast.error("Couldn't save the comment", errorMessage(error)),
  });
  const remove = useMutation({
    mutationFn: (id: number) => tasksApi.deleteComment(org.id, task.id, id),
    onSuccess: onDone,
    onError: (error) => toast.error("Couldn't delete the comment", errorMessage(error)),
  });

  if (comments.isPending) return <ListSkeleton rows={2} label="Loading comments" />;
  if (comments.isError) return <ErrorState error={comments.error} onRetry={() => void comments.refetch()} />;

  return (
    <div className="space-y-4">
      {comments.data.length === 0 && <p className="text-[13px] text-muted">No comments yet.</p>}
      <ul className="space-y-4">
        {comments.data.map((comment) => (
          <li key={comment.id} className="flex gap-3">
            {comment.author && <Avatar user={comment.author} size="sm" />}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-medium text-fg">{comment.author?.display_name ?? "Former member"}</span>
                <time dateTime={comment.created_at} className="text-subtle">
                  {timeAgo(comment.created_at)}
                </time>
                {comment.edited_at && <span className="text-subtle">(edited)</span>}
                {comment.can_edit && editing?.id !== comment.id && (
                  <span className="ml-auto flex gap-0.5">
                    <button
                      type="button"
                      onClick={() => setEditing({ id: comment.id, body: comment.body })}
                      aria-label="Edit comment"
                      className="rounded p-1 text-subtle hover:bg-surface-2 hover:text-fg"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove.mutate(comment.id)}
                      aria-label="Delete comment"
                      className="rounded p-1 text-subtle hover:bg-surface-2 hover:text-red-600"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </span>
                )}
              </div>
              {editing?.id === comment.id ? (
                <form
                  className="mt-1.5 space-y-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (editing.body.trim()) edit.mutate(editing);
                  }}
                >
                  <textarea
                    value={editing.body}
                    onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                    rows={3}
                    aria-label="Edit comment"
                    className={cn(controlClass, "border-border py-2")}
                  />
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" loading={edit.isPending}>
                      Save
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <p className="mt-1 text-[13px] whitespace-pre-wrap text-fg">{comment.body}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
      {canComment && (
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim()) add.mutate(draft);
          }}
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && draft.trim()) {
                e.preventDefault();
                add.mutate(draft);
              }
            }}
            rows={2}
            placeholder="Write a comment… (Ctrl+Enter to send)"
            aria-label="New comment"
            className={cn(controlClass, "border-border py-2")}
          />
          <Button type="submit" size="icon" loading={add.isPending} disabled={!draft.trim()} aria-label="Send comment">
            {!add.isPending && <Send className="h-4 w-4" />}
          </Button>
        </form>
      )}
    </div>
  );
}

export function FilesPanel({ task, canUpload }: { task: Task; canUpload: boolean }) {
  const org = useCurrentOrg();
  const queryClient = useQueryClient();
  const toast = useToast();
  const refresh = useRefreshTask(task.id);
  const inputRef = useRef<HTMLInputElement>(null);
  const key = taskKeys.attachments(org.id, task.id);
  const files = useQuery({ queryKey: key, queryFn: () => tasksApi.attachments(org.id, task.id) });

  const onDone = () => {
    void queryClient.invalidateQueries({ queryKey: key });
    refresh();
  };
  const upload = useMutation({
    mutationFn: async (list: File[]) => {
      for (const file of list) await tasksApi.upload(org.id, task.id, file);
    },
    onSuccess: onDone,
    onError: (error) => {
      onDone();
      toast.error("Upload failed", errorMessage(error));
    },
  });
  const remove = useMutation({
    mutationFn: (id: number) => tasksApi.deleteAttachment(org.id, task.id, id),
    onSuccess: onDone,
    onError: (error) => toast.error("Couldn't remove the file", errorMessage(error)),
  });

  if (files.isPending) return <ListSkeleton rows={2} label="Loading files" />;
  if (files.isError) return <ErrorState error={files.error} onRetry={() => void files.refetch()} />;

  return (
    <div className="space-y-3">
      {canUpload && (
        <>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="sr-only"
            aria-label="Choose files to upload"
            onChange={(e) => {
              const list = Array.from(e.target.files ?? []);
              if (list.length) upload.mutate(list);
              e.target.value = "";
            }}
          />
          <Button variant="secondary" size="sm" loading={upload.isPending} onClick={() => inputRef.current?.click()}>
            <Upload className="h-3.5 w-3.5" aria-hidden /> Upload files
          </Button>
        </>
      )}
      {files.data.length === 0 ? (
        <p className="text-[13px] text-muted">No files attached.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {files.data.map((file) => (
            <li key={file.id} className="flex items-center gap-3 px-3 py-2.5">
              <FileText className="h-4 w-4 shrink-0 text-subtle" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-fg">{file.filename}</p>
                <p className="text-[11px] text-subtle">
                  {formatBytes(file.size)} · {file.uploaded_by?.display_name ?? "Former member"} · {timeAgo(file.created_at)}
                </p>
              </div>
              <a
                href={file.download_url}
                className="rounded-md p-1.5 text-subtle hover:bg-surface-2 hover:text-fg"
                aria-label={`Download ${file.filename}`}
              >
                <Download className="h-3.5 w-3.5" />
              </a>
              {canUpload && (
                <button
                  type="button"
                  onClick={() => remove.mutate(file.id)}
                  className="rounded-md p-1.5 text-subtle hover:bg-surface-2 hover:text-red-600"
                  aria-label={`Remove ${file.filename}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const FIELD_LABELS: Record<string, string> = {
  title: "title",
  description: "description",
  state: "status",
  priority: "priority",
  milestone: "milestone",
  start_date: "start date",
  due_date: "due date",
  assignees: "assignees",
  tags: "tags",
  custom_fields: "custom fields",
};

function describe(entry: Activity): string {
  const field = FIELD_LABELS[entry.field] ?? entry.field;
  switch (entry.verb) {
    case "created":
      return "created the task";
    case "commented":
      return "commented";
    case "attached":
      return `attached ${entry.new_value}`;
    case "detached":
      return `removed ${entry.old_value}`;
    case "moved":
      return `moved it from ${entry.old_value || "—"} to ${entry.new_value}`;
    default:
      if (entry.field === "description" || entry.field === "custom_fields") return `updated the ${field}`;
      if (!entry.new_value) return `cleared the ${field}`;
      return `set the ${field} to ${entry.new_value}`;
  }
}

export function ActivityPanel({ task }: { task: Task }) {
  const org = useCurrentOrg();
  const activity = useQuery({
    queryKey: taskKeys.activity(org.id, task.id),
    queryFn: () => tasksApi.activity(org.id, task.id),
  });
  if (activity.isPending) return <ListSkeleton rows={3} label="Loading activity" />;
  if (activity.isError) return <ErrorState error={activity.error} onRetry={() => void activity.refetch()} />;

  return (
    <ol className="relative space-y-3 border-l border-border pl-4">
      {activity.data.results.map((entry) => (
        <li key={entry.id} className="text-[13px]">
          <span aria-hidden className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-border-strong" />
          <span className="font-medium text-fg">{entry.actor?.display_name ?? "Someone"}</span>{" "}
          <span className="text-muted">{describe(entry)}</span>{" "}
          <time dateTime={entry.created_at} className="text-xs text-subtle">
            {timeAgo(entry.created_at)}
          </time>
        </li>
      ))}
      {activity.data.results.length === 0 && (
        <li className="flex items-center gap-2 text-[13px] text-muted">
          <History className="h-4 w-4" aria-hidden /> No activity yet.
        </li>
      )}
    </ol>
  );
}
