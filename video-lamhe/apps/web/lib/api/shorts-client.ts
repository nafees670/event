import type {
  AdminShortCreateInput,
  AdminShortListQuery,
  AdminShortUpdateInput,
  ManagedShort,
  PageMeta,
  PublicShort,
  ShortCreateInput,
  ShortUpdateInput,
} from '@video-lamhe/shared';
import { api, apiWithMeta } from './client';

const qs = (q: Record<string, unknown>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const shortKeys = {
  admin: (q: AdminShortListQuery) => ['admin', 'shorts', q] as const,
  mine: ['operator', 'shorts'] as const,
  saved: ['shorts', 'saved'] as const,
};

export const adminShorts = {
  list: (q: AdminShortListQuery) => apiWithMeta<ManagedShort[], PageMeta>(`/admin/shorts${qs(q)}`),
  create: (body: AdminShortCreateInput) =>
    api<ManagedShort>('/admin/shorts', { method: 'POST', body }),
  update: (id: string, body: AdminShortUpdateInput) =>
    api<ManagedShort>(`/admin/shorts/${id}`, { method: 'PATCH', body }),
  remove: (id: string) => api(`/admin/shorts/${id}`, { method: 'DELETE' }),
};

export const myShorts = {
  list: () => api<ManagedShort[]>('/operator/shorts'),
  create: (body: ShortCreateInput) =>
    api<ManagedShort>('/operator/shorts', { method: 'POST', body }),
  update: (id: string, body: ShortUpdateInput) =>
    api<ManagedShort>(`/operator/shorts/${id}`, { method: 'PATCH', body }),
  remove: (id: string) => api(`/operator/shorts/${id}`, { method: 'DELETE' }),
};

export const fetchSavedShorts = () => api<PublicShort[]>('/shorts/saved');
