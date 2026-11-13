import type {
  AdminCity,
  AdminDroneModel,
  AdminOperatorCreateInput,
  AdminOperatorListQuery,
  AdminOperatorUpdateInput,
  AuthResult,
  CityCreateInput,
  CityUpdateInput,
  DroneModelCreateInput,
  DroneModelUpdateInput,
  ManagedOperator,
  OperatorDroneInput,
  OperatorRegisterInput,
  OperatorSelfUpdateInput,
  OperatorStatus,
  PageMeta,
  PublicCity,
  PublicDroneModel,
} from '@video-lamhe/shared';
import { useAuthStore } from '@/stores/auth';
import { api, apiWithMeta } from './client';

export const queryKeys = {
  cities: ['cities'] as const,
  drones: ['drones'] as const,
  adminCities: ['admin', 'cities'] as const,
  adminDrones: ['admin', 'drones'] as const,
  adminOperators: (q: AdminOperatorListQuery) => ['admin', 'operators', q] as const,
  adminOperator: (id: string) => ['admin', 'operator', id] as const,
  myOperator: ['operator', 'me'] as const,
};

const qs = (q: Record<string, unknown>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q))
    if (v !== undefined && v !== '' && v !== null) p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

// Public
export const fetchCities = () => api<PublicCity[]>('/cities');
export const fetchDrones = () => api<PublicDroneModel[]>('/drones');

export async function registerOperator(input: OperatorRegisterInput) {
  const result = await api<AuthResult>('/auth/register/operator', { method: 'POST', body: input });
  useAuthStore.getState().setSession(result);
  return result;
}

// Admin
export const adminCities = {
  list: () => api<AdminCity[]>('/admin/cities'),
  create: (body: CityCreateInput) => api<{ id: string }>('/admin/cities', { method: 'POST', body }),
  update: (id: string, body: CityUpdateInput) =>
    api<{ id: string }>(`/admin/cities/${id}`, { method: 'PATCH', body }),
  remove: (id: string) => api(`/admin/cities/${id}`, { method: 'DELETE' }),
};

export const adminDrones = {
  list: () => api<AdminDroneModel[]>('/admin/drones'),
  create: (body: DroneModelCreateInput) =>
    api<{ id: string }>('/admin/drones', { method: 'POST', body }),
  update: (id: string, body: DroneModelUpdateInput) =>
    api<{ id: string }>(`/admin/drones/${id}`, { method: 'PATCH', body }),
  remove: (id: string) => api(`/admin/drones/${id}`, { method: 'DELETE' }),
};

export const adminOperators = {
  list: (q: AdminOperatorListQuery) =>
    apiWithMeta<ManagedOperator[], PageMeta>(`/admin/operators${qs(q)}`),
  get: (id: string) => api<ManagedOperator>(`/admin/operators/${id}`),
  create: (body: AdminOperatorCreateInput) =>
    api<ManagedOperator>('/admin/operators', { method: 'POST', body }),
  update: (id: string, body: AdminOperatorUpdateInput) =>
    api<ManagedOperator>(`/admin/operators/${id}`, { method: 'PATCH', body }),
  replaceDrones: (id: string, drones: OperatorDroneInput[]) =>
    api<ManagedOperator>(`/admin/operators/${id}/drones`, { method: 'PUT', body: { drones } }),
  setStatus: (id: string, status: OperatorStatus) =>
    api<ManagedOperator>(`/admin/operators/${id}/status`, { method: 'PATCH', body: { status } }),
  remove: (id: string) => api(`/admin/operators/${id}`, { method: 'DELETE' }),
};

// Operator (self)
export const myOperator = {
  get: () => api<ManagedOperator>('/operator/me'),
  update: (body: OperatorSelfUpdateInput) =>
    api<ManagedOperator>('/operator/me', { method: 'PATCH', body }),
  addDrone: (body: OperatorDroneInput) =>
    api<ManagedOperator>('/operator/drones', { method: 'POST', body }),
  updateDrone: (
    id: string,
    body: { pricePerEvent?: number | null; pricePerHour?: number | null; isAvailable?: boolean },
  ) => api<ManagedOperator>(`/operator/drones/${id}`, { method: 'PATCH', body }),
  removeDrone: (id: string) => api<ManagedOperator>(`/operator/drones/${id}`, { method: 'DELETE' }),
};
