import { rateLimit, ipKeyGenerator, type RateLimitRequestHandler } from 'express-rate-limit';
import type { Request } from 'express';
import type { ApiErrorBody } from '@video-lamhe/shared';
import { RATE_LIMITS, type RateLimitKey, type RateLimitName } from '../config/rateLimits.js';

function keyFor(kind: RateLimitKey, req: Request): string {
  const ip = ipKeyGenerator(req.ip ?? 'unknown');
  const userId = req.auth?.userId;
  switch (kind) {
    case 'ip':
      return ip;
    case 'ip+email': {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      return `${ip}|${email}`;
    }
    case 'user':
      // Mounted after requireAuth; the IP fallback is only a safety net.
      return userId ? `u:${userId}` : ip;
    case 'user-or-ip':
      return userId ? `u:${userId}` : ip;
  }
}

/**
 * Builds a limiter from config/rateLimits.ts. In-memory store for now;
 * Phase 8 passes a Redis store so limits are shared across instances.
 */
export function createLimiter(name: RateLimitName): RateLimitRequestHandler {
  const rule = RATE_LIMITS[name];
  return rateLimit({
    windowMs: rule.windowMs,
    limit: rule.limit,
    standardHeaders: 'draft-6', // RateLimit-Limit / -Remaining / -Reset (+ Retry-After on 429)
    legacyHeaders: false,
    skipSuccessfulRequests: 'skipSuccessfulRequests' in rule ? rule.skipSuccessfulRequests : false,
    keyGenerator: (req) => `${name}:${keyFor(rule.key, req)}`,
    handler: (_req, res) => {
      const body: ApiErrorBody = {
        error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' },
      };
      res.status(429).json(body);
    },
  });
}

export type Limiters = Record<RateLimitName, RateLimitRequestHandler>;

export function createLimiters(): Limiters {
  return Object.fromEntries(
    (Object.keys(RATE_LIMITS) as RateLimitName[]).map((n) => [n, createLimiter(n)]),
  ) as Limiters;
}
