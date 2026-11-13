import type { RequestHandler } from 'express';
import type { Role } from '@video-lamhe/shared';
import type { Env } from '../config/env.js';
import { AppError } from '../lib/errors.js';
import { verifyAccessToken } from '../lib/tokens.js';

function bearer(header: string | undefined): string | null {
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

/** Stateless: trusts the signed access token (15 min). Sets req.auth. */
export function requireAuth(env: Env): RequestHandler {
  return (req, _res, next) => {
    const token = bearer(req.headers.authorization);
    if (!token) return next(AppError.unauthorized());
    try {
      const claims = verifyAccessToken(env, token);
      req.auth = { userId: claims.sub, role: claims.role };
      next();
    } catch {
      next(new AppError(401, 'TOKEN_INVALID', 'Session expired, please log in again'));
    }
  };
}

/** Like requireAuth but lets guests through (req.auth undefined). Invalid tokens are still rejected. */
export function optionalAuth(env: Env): RequestHandler {
  return (req, res, next) => {
    if (!req.headers.authorization) return next();
    return requireAuth(env)(req, res, next);
  };
}

/** Use after requireAuth. */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) return next(AppError.unauthorized());
    if (!roles.includes(req.auth.role)) return next(AppError.forbidden());
    next();
  };
}
