import type {
  AuthResult,
  ForgotPasswordInput,
  LoginInput,
  PublicUser,
  RegisterInput,
  ResetPasswordInput,
  UpdateMeInput,
} from '@video-lamhe/shared';
import { useAuthStore } from '@/stores/auth';
import { useShortEngagement } from '@/stores/short-engagement';
import { api } from './client';

export async function login(input: LoginInput) {
  const result = await api<AuthResult>('/auth/login', { method: 'POST', body: input });
  useAuthStore.getState().setSession(result);
  return result;
}

export async function register(input: RegisterInput) {
  const result = await api<AuthResult>('/auth/register', { method: 'POST', body: input });
  useAuthStore.getState().setSession(result);
  return result;
}

export async function logout() {
  try {
    await api('/auth/logout', { method: 'POST' });
  } finally {
    useAuthStore.getState().clear();
    useShortEngagement.getState().clear(); // the next person on this device must not see these likes
  }
}

export async function updateMe(input: UpdateMeInput) {
  const user = await api<PublicUser>('/auth/me', { method: 'PATCH', body: input });
  useAuthStore.getState().setUser(user);
  return user;
}

export const forgotPassword = (input: ForgotPasswordInput) =>
  api<{ ok: true; message: string }>('/auth/forgot-password', { method: 'POST', body: input });

export const resetPassword = (input: ResetPasswordInput) =>
  api<{ ok: true }>('/auth/reset-password', { method: 'POST', body: input });
