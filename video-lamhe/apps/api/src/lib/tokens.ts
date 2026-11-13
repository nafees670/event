import { createHash, randomBytes, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { Role } from '@video-lamhe/shared';
import type { Env } from '../config/env.js';

export const ACCESS_TOKEN_TTL_SEC = 15 * 60;
export const REFRESH_TOKEN_TTL_SEC = 7 * 24 * 60 * 60;
const ISSUER = 'video-lamhe';

export interface AccessClaims {
  sub: string;
  role: Role;
}

export interface RefreshClaims {
  sub: string;
  /** Must equal User.refreshTokenVersion. */
  ver: number;
  jti: string;
  fam: string;
}

type Secrets = Pick<Env, 'JWT_ACCESS_SECRET' | 'JWT_REFRESH_SECRET'>;

export function signAccessToken(env: Secrets, claims: AccessClaims): string {
  return jwt.sign({ role: claims.role }, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    subject: claims.sub,
    issuer: ISSUER,
    audience: 'access',
    expiresIn: ACCESS_TOKEN_TTL_SEC,
  });
}

export function verifyAccessToken(env: Secrets, token: string): AccessClaims {
  const p = jwt.verify(token, env.JWT_ACCESS_SECRET, {
    algorithms: ['HS256'],
    issuer: ISSUER,
    audience: 'access',
  }) as jwt.JwtPayload;
  if (typeof p.sub !== 'string' || typeof p.role !== 'string') throw new Error('Malformed token');
  return { sub: p.sub, role: p.role as Role };
}

export function signRefreshToken(
  env: Secrets,
  input: { sub: string; ver: number; fam?: string },
): { token: string; claims: RefreshClaims } {
  const claims: RefreshClaims = {
    sub: input.sub,
    ver: input.ver,
    jti: randomUUID(),
    fam: input.fam ?? randomUUID(),
  };
  const token = jwt.sign({ ver: claims.ver, fam: claims.fam }, env.JWT_REFRESH_SECRET, {
    algorithm: 'HS256',
    subject: claims.sub,
    jwtid: claims.jti,
    issuer: ISSUER,
    audience: 'refresh',
    expiresIn: REFRESH_TOKEN_TTL_SEC,
  });
  return { token, claims };
}

export function verifyRefreshToken(env: Secrets, token: string): RefreshClaims {
  const p = jwt.verify(token, env.JWT_REFRESH_SECRET, {
    algorithms: ['HS256'],
    issuer: ISSUER,
    audience: 'refresh',
  }) as jwt.JwtPayload;
  if (
    typeof p.sub !== 'string' ||
    typeof p.jti !== 'string' ||
    typeof p.ver !== 'number' ||
    typeof p.fam !== 'string'
  ) {
    throw new Error('Malformed token');
  }
  return { sub: p.sub, ver: p.ver, jti: p.jti, fam: p.fam };
}

/** Opaque single-use token (password reset). Only the SHA-256 hash is stored. */
export function createOpaqueToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: sha256(token) };
}

export const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
