export interface ApiErrorBody {
  error: { code: string; message: string; details: Record<string, unknown> };
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** First message for a form field, if the backend reported one. */
  fieldError(field: string): string | undefined {
    const value = this.details[field];
    if (Array.isArray(value) && typeof value[0] === "string") return value[0];
    return typeof value === "string" ? value : undefined;
  }
}

type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, QueryValue>;
  /** Set false for calls that may legitimately run signed out (e.g. the invite page). */
  redirectOnAuthFailure?: boolean;
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
// Auth endpoints answer 401 for bad credentials; refreshing would be meaningless.
const NO_REFRESH_PREFIXES = ["/auth/login", "/auth/refresh", "/auth/logout", "/auth/register", "/auth/verify"];

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.split("; ").find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}

async function ensureCsrfToken(): Promise<string> {
  const existing = readCookie("csrftoken");
  if (existing) return existing;
  await fetch("/api/auth/csrf/", { credentials: "same-origin" });
  return readCookie("csrftoken") ?? "";
}

let refreshInFlight: Promise<boolean> | null = null;

/** Rotate the session once, even if many requests hit 401 at the same time. */
export function refreshSession(): Promise<boolean> {
  refreshInFlight ??= fetch("/api/auth/refresh/", { method: "POST", credentials: "same-origin" })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

export function redirectToLogin(reason: "expired" | "idle" = "expired"): void {
  if (typeof window === "undefined") return;
  const next = `${window.location.pathname}${window.location.search}`;
  window.location.assign(`/login?reason=${reason}&next=${encodeURIComponent(next)}`);
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const url = `/api${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

async function parseError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as Partial<ApiErrorBody>;
    if (body.error) return new ApiError(res.status, body.error.code, body.error.message, body.error.details);
  } catch {
    // Non-JSON error (e.g. a proxy error page); fall through.
  }
  const message = res.status >= 500 ? "The server had a problem. Try again in a moment." : res.statusText;
  return new ApiError(res.status, res.status >= 500 ? "server_error" : "error", message);
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}, retried = false): Promise<T> {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = { Accept: "application/json" };
  let body: BodyInit | undefined;

  if (options.body instanceof FormData) {
    body = options.body;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }
  if (!SAFE_METHODS.has(method)) headers["X-CSRFToken"] = await ensureCsrfToken();

  let res: Response;
  try {
    res = await fetch(buildUrl(path, options.query), { method, headers, body, credentials: "same-origin" });
  } catch {
    throw new ApiError(0, "network", "Can't reach the server. Check your connection and try again.");
  }

  if (res.status === 401 && !retried && !NO_REFRESH_PREFIXES.some((p) => path.startsWith(p))) {
    if (await refreshSession()) return apiFetch<T>(path, options, true);
    if (options.redirectOnAuthFailure !== false) redirectToLogin();
  }
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}
