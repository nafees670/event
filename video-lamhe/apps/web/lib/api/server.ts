import 'server-only';
import { notFound } from 'next/navigation';
import type { ApiErrorBody } from '@video-lamhe/shared';
import { publicEnv } from '@/lib/env';

/** Server components talk to the API directly (INTERNAL_API_URL lets prod use a private hostname). */
const base = () => process.env.INTERNAL_API_URL || publicEnv.NEXT_PUBLIC_API_URL;

export class ServerApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

interface Options {
  /** ISR seconds (default 60). */
  revalidate?: number;
  /** Return null on 404 instead of rendering the not-found page. */
  allowMissing?: boolean;
}

export async function serverApi<T, M = undefined>(
  path: string,
  opts: Options = {},
): Promise<{ data: T; meta: M }> {
  const res = await fetch(`${base()}${path}`, {
    headers: { Accept: 'application/json' },
    next: { revalidate: opts.revalidate ?? 60 },
  });
  if (res.status === 404) {
    if (!opts.allowMissing) notFound();
    return { data: null as T, meta: undefined as M };
  }
  if (!res.ok) {
    let body: Partial<ApiErrorBody> = {};
    try {
      body = (await res.json()) as ApiErrorBody;
    } catch {
      // ignore
    }
    throw new ServerApiError(
      res.status,
      body.error?.code ?? 'HTTP_ERROR',
      body.error?.message ?? res.statusText,
    );
  }
  return (await res.json()) as { data: T; meta: M };
}

/** Builds '?a=1&b=2' from defined values only. */
export function qs(params: Record<string, string | number | undefined | null>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params))
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
}

/**
 * For optional page sections (e.g. Home's featured shorts): any failure → null instead of an
 * error page. Also lets `next build` succeed when the API isn't reachable (ISR fills it in later).
 */
export async function serverApiSafe<T, M = undefined>(path: string, opts: Options = {}) {
  try {
    return await serverApi<T, M>(path, { ...opts, allowMissing: true });
  } catch {
    return null;
  }
}
