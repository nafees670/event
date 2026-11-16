import { apiFetch } from "./client";
import type {
  Invitation,
  Organization,
  OrgMember,
  OrgRole,
  Paginated,
  PublicInvitation,
  Space,
  SpaceMember,
  SpaceRole,
} from "./types";

export interface InvitePayload {
  email: string;
  role: OrgRole;
  space: number | null;
  space_role: SpaceRole | "";
}

export const orgsApi = {
  list: () => apiFetch<Organization[]>("/orgs/"),
  create: (name: string) => apiFetch<Organization>("/orgs/", { method: "POST", body: { name } }),
  update: (orgId: number, data: { name: string }) =>
    apiFetch<Organization>(`/orgs/${orgId}/`, { method: "PATCH", body: data }),

  members: (orgId: number, params: { page?: number; search?: string } = {}) =>
    apiFetch<Paginated<OrgMember>>(`/orgs/${orgId}/members/`, { query: { page_size: 100, ...params } }),
  updateMemberRole: (orgId: number, memberId: number, role: OrgRole) =>
    apiFetch<OrgMember>(`/orgs/${orgId}/members/${memberId}/`, { method: "PATCH", body: { role } }),
  removeMember: (orgId: number, memberId: number) =>
    apiFetch<void>(`/orgs/${orgId}/members/${memberId}/`, { method: "DELETE" }),

  invitations: (orgId: number) =>
    apiFetch<Paginated<Invitation>>(`/orgs/${orgId}/invitations/`, { query: { pending: true, page_size: 100 } }),
  invite: (orgId: number, data: InvitePayload) =>
    apiFetch<Invitation>(`/orgs/${orgId}/invitations/`, { method: "POST", body: data }),
  resendInvitation: (orgId: number, id: number) =>
    apiFetch<Invitation>(`/orgs/${orgId}/invitations/${id}/resend/`, { method: "POST" }),
  revokeInvitation: (orgId: number, id: number) =>
    apiFetch<void>(`/orgs/${orgId}/invitations/${id}/`, { method: "DELETE" }),

  publicInvitation: (token: string) =>
    apiFetch<PublicInvitation>(`/invitations/${encodeURIComponent(token)}/`, { redirectOnAuthFailure: false }),
  acceptInvitation: (token: string) =>
    apiFetch<Organization>(`/invitations/${encodeURIComponent(token)}/accept/`, { method: "POST" }),

  spaces: (orgId: number) => apiFetch<Space[]>(`/orgs/${orgId}/spaces/`),
  spaceMembers: (orgId: number, spaceId: number) =>
    apiFetch<Paginated<SpaceMember>>(`/orgs/${orgId}/spaces/${spaceId}/members/`, { query: { page_size: 100 } }),
  addSpaceMember: (orgId: number, spaceId: number, userId: number, role: SpaceRole) =>
    apiFetch<SpaceMember>(`/orgs/${orgId}/spaces/${spaceId}/members/`, {
      method: "POST",
      body: { user_id: userId, role },
    }),
  removeSpaceMember: (orgId: number, spaceId: number, membershipId: number) =>
    apiFetch<void>(`/orgs/${orgId}/spaces/${spaceId}/members/${membershipId}/`, { method: "DELETE" }),
};

export const queryKeys = {
  me: ["me"] as const,
  orgs: ["orgs"] as const,
  members: (orgId: number) => ["orgs", orgId, "members"] as const,
  invitations: (orgId: number) => ["orgs", orgId, "invitations"] as const,
  spaces: (orgId: number) => ["orgs", orgId, "spaces"] as const,
};
