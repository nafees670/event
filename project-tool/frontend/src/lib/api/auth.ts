import { apiFetch } from "./client";
import type { Detail, User } from "./types";

export const authApi = {
  register: (data: { email: string; password: string; full_name: string }) =>
    apiFetch<Detail>("/auth/register/", { method: "POST", body: data }),
  verifyEmail: (data: { email: string; code: string }) =>
    apiFetch<Detail>("/auth/verify-email/", { method: "POST", body: data }),
  resendVerification: (email: string) =>
    apiFetch<Detail>("/auth/resend-verification/", { method: "POST", body: { email } }),
  login: (data: { email: string; password: string }) => apiFetch<User>("/auth/login/", { method: "POST", body: data }),
  logout: () => apiFetch<Detail>("/auth/logout/", { method: "POST" }),
  me: (opts: { redirectOnAuthFailure?: boolean } = {}) => apiFetch<User>("/auth/me/", opts),
  updateMe: (data: { full_name: string }) => apiFetch<User>("/auth/me/", { method: "PATCH", body: data }),
  requestPasswordReset: (email: string) =>
    apiFetch<Detail>("/auth/password-reset/", { method: "POST", body: { email } }),
  confirmPasswordReset: (data: { uid: string; token: string; new_password: string }) =>
    apiFetch<Detail>("/auth/password-reset/confirm/", { method: "POST", body: data }),
};
