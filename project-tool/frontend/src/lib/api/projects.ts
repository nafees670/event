import { apiFetch } from "./client";
import type { Milestone, MilestoneStatus, Paginated, Project, ProjectStatus } from "./types";

export interface ProjectPayload {
  space?: number;
  name: string;
  short_code: string;
  description: string;
  status: ProjectStatus;
  lead_id: number | null;
  start_date: string | null;
  target_date: string | null;
  repo_url: string;
  docs_url: string;
  drive_url: string;
}

export interface MilestonePayload {
  name: string;
  description: string;
  weight: number;
  due_date: string | null;
}

export const projectsApi = {
  list: (orgId: number, params: { space?: number; status?: ProjectStatus; search?: string } = {}) =>
    apiFetch<Paginated<Project>>(`/orgs/${orgId}/projects/`, { query: { page_size: 200, ...params } }),
  get: (orgId: number, id: number) => apiFetch<Project>(`/orgs/${orgId}/projects/${id}/`),
  create: (orgId: number, data: ProjectPayload) =>
    apiFetch<Project>(`/orgs/${orgId}/projects/`, { method: "POST", body: data }),
  update: (orgId: number, id: number, data: Partial<ProjectPayload>) =>
    apiFetch<Project>(`/orgs/${orgId}/projects/${id}/`, { method: "PATCH", body: data }),
  remove: (orgId: number, id: number) => apiFetch<void>(`/orgs/${orgId}/projects/${id}/`, { method: "DELETE" }),

  milestones: (orgId: number, projectId: number) =>
    apiFetch<Milestone[]>(`/orgs/${orgId}/projects/${projectId}/milestones/`),
  createMilestone: (orgId: number, projectId: number, data: MilestonePayload) =>
    apiFetch<Milestone>(`/orgs/${orgId}/projects/${projectId}/milestones/`, { method: "POST", body: data }),
  updateMilestone: (orgId: number, projectId: number, id: number, data: Partial<MilestonePayload>) =>
    apiFetch<Milestone>(`/orgs/${orgId}/projects/${projectId}/milestones/${id}/`, { method: "PATCH", body: data }),
  deleteMilestone: (orgId: number, projectId: number, id: number) =>
    apiFetch<void>(`/orgs/${orgId}/projects/${projectId}/milestones/${id}/`, { method: "DELETE" }),
  overrideMilestone: (orgId: number, projectId: number, id: number, status: MilestoneStatus) =>
    apiFetch<Milestone>(`/orgs/${orgId}/projects/${projectId}/milestones/${id}/override/`, { method: "POST", body: { status } }),
  resetMilestone: (orgId: number, projectId: number, id: number) =>
    apiFetch<Milestone>(`/orgs/${orgId}/projects/${projectId}/milestones/${id}/reset-status/`, { method: "POST" }),
  reorderMilestones: (orgId: number, projectId: number, ids: number[]) =>
    apiFetch<void>(`/orgs/${orgId}/projects/${projectId}/milestones/reorder/`, { method: "POST", body: { ids } }),
};

export const projectKeys = {
  all: (orgId: number) => ["orgs", orgId, "projects"] as const,
  list: (orgId: number, space: number | "all") => ["orgs", orgId, "projects", "list", space] as const,
  detail: (orgId: number, id: number) => ["orgs", orgId, "projects", "detail", id] as const,
  milestones: (orgId: number, id: number) => ["orgs", orgId, "projects", "detail", id, "milestones"] as const,
};
