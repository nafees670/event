/**
 * All rate limits in one place (Section 8.8). Tune here.
 * key: what a client is identified by — 'ip', 'ip+email' (from body.email), 'user' (requires auth)
 * or 'user-or-ip'.
 */
export type RateLimitKey = 'ip' | 'ip+email' | 'user' | 'user-or-ip';

export interface RateLimitRule {
  windowMs: number;
  limit: number;
  key: RateLimitKey;
  /** Only count failed (>= 400) responses, e.g. login. */
  skipSuccessfulRequests?: boolean;
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export const RATE_LIMITS = {
  global: { windowMs: 15 * MIN, limit: 300, key: 'ip' },
  login: { windowMs: 15 * MIN, limit: 5, key: 'ip+email', skipSuccessfulRequests: true },
  register: { windowMs: HOUR, limit: 5, key: 'ip' },
  passwordReset: { windowMs: HOUR, limit: 3, key: 'ip+email' },
  contactReveal: { windowMs: HOUR, limit: 30, key: 'user' },
  inquiry: { windowMs: HOUR, limit: 10, key: 'user' },
  booking: { windowMs: DAY, limit: 10, key: 'user' },
  uploadSignature: { windowMs: HOUR, limit: 30, key: 'user' },
  uploadSignatureAdmin: { windowMs: HOUR, limit: 200, key: 'user' },
  engagement: { windowMs: MIN, limit: 60, key: 'user-or-ip' },
  admin: { windowMs: 15 * MIN, limit: 1000, key: 'user' },
  /** Socket.io send_message — enforced by socket middleware (Phase 6). */
  chatMessage: { windowMs: MIN, limit: 30, key: 'user' },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitName = keyof typeof RATE_LIMITS;

/** Account lockout after repeated failed logins for the same email (Section 8.7). */
export const LOGIN_LOCKOUT = { maxFailures: 5, windowMs: 15 * MIN, lockMs: 15 * MIN } as const;
