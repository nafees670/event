import type { Request, Response } from 'express';
import type { AuthResult } from '@video-lamhe/shared';
import type { Env } from '../config/env.js';
import { RefreshSession } from '../models/RefreshSession.js';
import { toPublicUser, type UserDoc } from '../models/User.js';
import {
  ACCESS_TOKEN_TTL_SEC,
  REFRESH_TOKEN_TTL_SEC,
  signAccessToken,
  signRefreshToken,
} from '../lib/tokens.js';
import { API_PREFIX } from '../config/constants.js';

export const REFRESH_COOKIE = 'vl_rt';
const REFRESH_COOKIE_PATH = `${API_PREFIX}/auth`;

export function setRefreshCookie(env: Env, res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_TOKEN_TTL_SEC * 1000,
  });
}

export function clearRefreshCookie(env: Env, res: Response) {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: REFRESH_COOKIE_PATH,
  });
}

/** Issues an access token + a new refresh session (optionally continuing a rotation family). */
export async function issueSession(
  env: Env,
  req: Request,
  res: Response,
  user: UserDoc,
  family?: string,
): Promise<AuthResult> {
  const { token, claims } = signRefreshToken(env, {
    sub: user.id as string,
    ver: user.refreshTokenVersion,
    fam: family,
  });
  await RefreshSession.create({
    user: user._id,
    jti: claims.jti,
    family: claims.fam,
    userAgent: req.get('user-agent')?.slice(0, 300),
    ip: req.ip,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SEC * 1000),
  });
  setRefreshCookie(env, res, token);
  return {
    user: toPublicUser(user),
    accessToken: signAccessToken(env, { sub: user.id as string, role: user.role }),
    expiresIn: ACCESS_TOKEN_TTL_SEC,
  };
}
