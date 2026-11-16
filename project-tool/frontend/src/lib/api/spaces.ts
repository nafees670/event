import { apiFetch } from "./client";
import type { CustomField, DepartmentType, FieldType, Space, StateCategory, Tag, UserSummary, WorkflowState } from "./types";

export interface SpacePayload {
  name: string;
  short_code: string;
  department_type?: DepartmentType;
  color: string;
  description: string;
}

export interface StatePayload {
  name: string;
  color: string;
  category: StateCategory;
  is_default?: boolean;
}

export interface FieldPayload {
  name: string;
  field_type?: FieldType;
  options: string[];
  required: boolean;
}

const base = (orgId: number, spaceId: number) => `/orgs/${orgId}/spaces/${spaceId}`;

export const spacesApi = {
  create: (orgId: number, data: SpacePayload) => apiFetch<Space>(`/orgs/${orgId}/spaces/`, { method: "POST", body: data }),
  update: (orgId: number, spaceId: number, data: Partial<SpacePayload>) =>
    apiFetch<Space>(`${base(orgId, spaceId)}/`, { method: "PATCH", body: data }),
  remove: (orgId: number, spaceId: number) => apiFetch<void>(`${base(orgId, spaceId)}/`, { method: "DELETE" }),
  participants: (orgId: number, spaceId: number) => apiFetch<UserSummary[]>(`${base(orgId, spaceId)}/participants/`),

  states: (orgId: number, spaceId: number) => apiFetch<WorkflowState[]>(`${base(orgId, spaceId)}/states/`),
  createState: (orgId: number, spaceId: number, data: StatePayload) =>
    apiFetch<WorkflowState>(`${base(orgId, spaceId)}/states/`, { method: "POST", body: data }),
  updateState: (orgId: number, spaceId: number, id: number, data: Partial<StatePayload>) =>
    apiFetch<WorkflowState>(`${base(orgId, spaceId)}/states/${id}/`, { method: "PATCH", body: data }),
  deleteState: (orgId: number, spaceId: number, id: number, moveTo?: number) =>
    apiFetch<void>(`${base(orgId, spaceId)}/states/${id}/`, { method: "DELETE", query: { move_to: moveTo } }),
  reorderStates: (orgId: number, spaceId: number, ids: number[]) =>
    apiFetch<void>(`${base(orgId, spaceId)}/states/reorder/`, { method: "POST", body: { ids } }),

  fields: (orgId: number, spaceId: number) => apiFetch<CustomField[]>(`${base(orgId, spaceId)}/fields/`),
  createField: (orgId: number, spaceId: number, data: FieldPayload) =>
    apiFetch<CustomField>(`${base(orgId, spaceId)}/fields/`, { method: "POST", body: data }),
  updateField: (orgId: number, spaceId: number, id: number, data: Partial<FieldPayload>) =>
    apiFetch<CustomField>(`${base(orgId, spaceId)}/fields/${id}/`, { method: "PATCH", body: data }),
  deleteField: (orgId: number, spaceId: number, id: number) =>
    apiFetch<void>(`${base(orgId, spaceId)}/fields/${id}/`, { method: "DELETE" }),
  reorderFields: (orgId: number, spaceId: number, ids: number[]) =>
    apiFetch<void>(`${base(orgId, spaceId)}/fields/reorder/`, { method: "POST", body: { ids } }),

  tags: (orgId: number, spaceId: number) => apiFetch<Tag[]>(`${base(orgId, spaceId)}/tags/`),
  createTag: (orgId: number, spaceId: number, data: { name: string; color: string }) =>
    apiFetch<Tag>(`${base(orgId, spaceId)}/tags/`, { method: "POST", body: data }),
  updateTag: (orgId: number, spaceId: number, id: number, data: { name?: string; color?: string }) =>
    apiFetch<Tag>(`${base(orgId, spaceId)}/tags/${id}/`, { method: "PATCH", body: data }),
  deleteTag: (orgId: number, spaceId: number, id: number) =>
    apiFetch<void>(`${base(orgId, spaceId)}/tags/${id}/`, { method: "DELETE" }),
};

export const spaceKeys = {
  states: (orgId: number, spaceId: number) => ["orgs", orgId, "spaces", spaceId, "states"] as const,
  fields: (orgId: number, spaceId: number) => ["orgs", orgId, "spaces", spaceId, "fields"] as const,
  tags: (orgId: number, spaceId: number) => ["orgs", orgId, "spaces", spaceId, "tags"] as const,
  participants: (orgId: number, spaceId: number) => ["orgs", orgId, "spaces", spaceId, "participants"] as const,
};
