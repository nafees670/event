/**
 * Account lockout (Section 8.7): 5 failed logins for the same email within the window
 * → locked for 15 minutes. Keyed by email (not user) so unknown emails behave the same.
 *
 * In-memory for now; Phase 8 swaps in a Redis implementation of the same interface
 * so the lock is shared across API instances.
 */
export interface LockoutStore {
  /** ms until unlock, or 0 if not locked. */
  lockedFor(key: string): Promise<number>;
  registerFailure(key: string): Promise<{ lockedFor: number }>;
  reset(key: string): Promise<void>;
}

export interface LockoutOptions {
  maxFailures: number;
  windowMs: number;
  lockMs: number;
  now?: () => number;
}

export function createMemoryLockoutStore(opts: LockoutOptions): LockoutStore {
  const now = opts.now ?? Date.now;
  const entries = new Map<string, { failures: number; windowStart: number; lockedUntil: number }>();

  const sweep = () => {
    const t = now();
    for (const [k, e] of entries) {
      if (e.lockedUntil < t && e.windowStart + opts.windowMs < t) entries.delete(k);
    }
  };
  const timer = setInterval(sweep, 60_000);
  timer.unref();

  return {
    async lockedFor(key) {
      const e = entries.get(key);
      return e ? Math.max(0, e.lockedUntil - now()) : 0;
    },
    async registerFailure(key) {
      const t = now();
      let e = entries.get(key);
      if (!e || e.windowStart + opts.windowMs < t) {
        e = { failures: 0, windowStart: t, lockedUntil: 0 };
        entries.set(key, e);
      }
      e.failures += 1;
      if (e.failures >= opts.maxFailures) {
        e.lockedUntil = t + opts.lockMs;
        e.failures = 0;
        e.windowStart = t;
      }
      return { lockedFor: Math.max(0, e.lockedUntil - t) };
    },
    async reset(key) {
      entries.delete(key);
    },
  };
}
