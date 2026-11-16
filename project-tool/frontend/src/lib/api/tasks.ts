import { apiFetch } from "./client";
import type { Activity, Attachment, Comment, CustomFieldValue, Paginated, Priority, StateCategory, Task } from "./types";

export interface TaskFilters {
  space?: number;
  project?: number;
  assignee?: string;
  priority?: Priority;
  tag?: number;
  due?: "overdue" | "week" | "none";
  milestone?: number;
  search?: string;
}

export interface TaskPayload {
  project: number;
  title: string;
  description: string;
  state_id: number;
  priority: Priority;
  milestone_id: number | null;
  assignee_ids: number[];
  tag_ids: number[];
  start_date: string | null;
  due_date: string | null;
  custom_fields: Record<string, CustomFieldValue | null>;
}

export interface MovePayload {
  state_id?: number;
  category?: StateCategory;
  after_id?: number | null;
  before_id?: number | null;
}

/** The board loads a whole space at once; the backend caps a page at this size. */
export const BOARD_PAGE_SIZE = 500;

const base = (orgId: number) => `/orgs/${orgId}/tasks`;

export const tasksApi = {
  list: (orgId: number, filters: TaskFilters, pageSize = BOARD_PAGE_SIZE) =>
    apiFetch<Paginated<Task>>(`${base(orgId)}/`, { query: { page_size: pageSize, ...filters } }),
  get: (orgId: number, id: number) => apiFetch<Task>(`${base(orgId)}/${id}/`),
  create: (orgId: number, data: Partial<TaskPayload> & { project: number; title: string }) =>
    apiFetch<Task>(`${base(orgId)}/`, { method: "POST", body: data }),
  update: (orgId: number, id: number, data: Partial<Omit<TaskPayload, "project">>) =>
    apiFetch<Task>(`${base(orgId)}/${id}/`, { method: "PATCH", body: data }),
  remove: (orgId: number, id: number) => apiFetch<void>(`${base(orgId)}/${id}/`, { method: "DELETE" }),
  move: (orgId: number, id: number, data: MovePayload) =>
    apiFetch<Task>(`${base(orgId)}/${id}/move/`, { method: "POST", body: data }),

  comments: (orgId: number, taskId: number) => apiFetch<Comment[]>(`${base(orgId)}/${taskId}/comments/`),
  addComment: (orgId: number, taskId: number, body: string) =>
    apiFetch<Comment>(`${base(orgId)}/${taskId}/comments/`, { method: "POST", body: { body } }),
  editComment: (orgId: number, taskId: number, id: number, body: string) =>
    apiFetch<Comment>(`${base(orgId)}/${taskId}/comments/${id}/`, { method: "PATCH", body: { body } }),
  deleteComment: (orgId: number, taskId: number, id: number) =>
    apiFetch<void>(`${base(orgId)}/${taskId}/comments/${id}/`, { method: "DELETE" }),

  attachments: (orgId: number, taskId: number) => apiFetch<Attachment[]>(`${base(orgId)}/${taskId}/attachments/`),
  upload: (orgId: number, taskId: number, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return apiFetch<Attachment>(`${base(orgId)}/${taskId}/attachments/`, { method: "POST", body: form });
  },
  deleteAttachment: (orgId: number, taskId: number, id: number) =>
    apiFetch<void>(`${base(orgId)}/${taskId}/attachments/${id}/`, { method: "DELETE" }),

  activity: (orgId: number, taskId: number) =>
    apiFetch<Paginated<Activity>>(`${base(orgId)}/${taskId}/activity/`, { query: { page_size: 100 } }),
};

export const taskKeys = {
  all: (orgId: number) => ["orgs", orgId, "tasks"] as const,
  list: (orgId: number, filters: TaskFilters) => ["orgs", orgId, "tasks", "list", filters] as const,
  detail: (orgId: number, id: number) => ["orgs", orgId, "tasks", "detail", id] as const,
  comments: (orgId: number, id: number) => ["orgs", orgId, "tasks", "detail", id, "comments"] as const,
  attachments: (orgId: number, id: number) => ["orgs", orgId, "tasks", "detail", id, "attachments"] as const,
  activity: (orgId: number, id: number) => ["orgs", orgId, "tasks", "detail", id, "activity"] as const,
};
