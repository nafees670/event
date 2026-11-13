import { toast } from 'sonner';
import type { ApiErrorBody, AuthResult } from '@video-lamhe/shared';
import { publicEnv } from '@/lib/env';
import { useAuthStore } from '@/stores/auth';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  /** Internal: prevents infinite refresh loops. */
  _retried?: boolean;
}

const RATE_LIMIT_MESSAGE =
  'Thori der baad try karein — too many requests, please try again shortly.';

async function parseError(res: Response): Promise<ApiError> {
  let body: Partial<ApiErrorBody> = {};
  try {
    body = (await res.json()) as ApiErrorBody;
  } catch {
    // non-JSON (proxy error page etc.)
  }
  return new ApiError(
    res.status,
    body.error?.code ?? 'HTTP_ERROR',
    body.error?.message ?? 'Something went wrong. Please try again.',
    body.error?.details,
  );
}

async function rawFetch(path: string, opts: RequestOptions, token: string | null) {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${publicEnv.NEXT_PUBLIC_API_URL}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    credentials: 'include', // refresh cookie
    signal: opts.signal,
  });
}

let refreshInFlight: Promise<AuthResult | null> | null = null;

/**
 * Exchanges the httpOnly refresh cookie for a new access token. Single-flight per tab;
 * retries once on REFRESH_CONFLICT (another tab rotated the cookie a moment ago).
 */
export function refreshSession(): Promise<AuthResult | null> {
  refreshInFlight ??= (async () => {
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const res = await rawFetch('/auth/refresh', { method: 'POST' }, null);
        if (res.ok) {
          const { data } = (await res.json()) as { data: AuthResult };
          useAuthStore.getState().setSession(data);
          return data;
        }
        const err = await parseError(res);
        if (err.code === 'REFRESH_CONFLICT' && attempt === 0) {
          await new Promise((r) => setTimeout(r, 300));
          continue;
        }
        break;
      }
      useAuthStore.getState().clear();
      return null;
    } catch {
      // Network error: treat as logged out for now (public pages still work).
      useAuthStore.getState().clear();
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

/** Typed fetch returning `{ data, meta }`; throws ApiError on failure. */
export async function apiWithMeta<T, M = undefined>(
  path: string,
  opts: RequestOptions = {},
): Promise<{ data: T; meta: M }> {
  const token = useAuthStore.getState().accessToken;
  const res = await rawFetch(path, opts, token);

  if (res.status === 401 && token && !opts._retried) {
    const refreshed = await refreshSession();
    if (refreshed) return apiWithMeta<T, M>(path, { ...opts, _retried: true });
  }

  if (!res.ok) {
    const err = await parseError(res);
    if (err.status === 429 && err.code === 'RATE_LIMITED') toast.error(RATE_LIMIT_MESSAGE);
    throw err;
  }
  return (await res.json()) as { data: T; meta: M };
}

/** Typed fetch for the API. Returns `data` from `{ data }`; throws ApiError on failure. */
export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  return (await apiWithMeta<T>(path, opts)).data;
}
