import { Router, type RequestHandler } from 'express';
import {
  forgotPasswordSchema,
  loginSchema,
  operatorRegisterSchema,
  registerSchema,
  resetPasswordSchema,
  updateMeSchema,
  type ApiSuccess,
  type AuthResult,
  type PublicUser,
} from '@video-lamhe/shared';
import type { z } from 'zod';
import type { Env } from '../config/env.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { AppError } from '../lib/errors.js';
import type { LockoutStore } from '../lib/lockout.js';
import type { Logger } from 'pino';
import type { Mailer } from '../lib/mailer.js';
import type { MediaService } from '../lib/media.js';
import { burnPasswordCheck, hashPassword, verifyPassword } from '../lib/password.js';
import { createOpaqueToken, sha256, verifyRefreshToken } from '../lib/tokens.js';
import { requireAuth } from '../middleware/auth.js';
import type { Limiters } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { RefreshSession } from '../models/RefreshSession.js';
import { User, toPublicUser } from '../models/User.js';
import { REFRESH_COOKIE, clearRefreshCookie, issueSession } from '../services/auth.js';
import { createOperatorAccount } from '../services/operators.js';

/** A rotated token presented again within this window is treated as a benign multi-tab race. */
const REFRESH_RACE_GRACE_MS = 10_000;
const RESET_TOKEN_TTL_MS = 30 * 60_000;

export interface AuthRouterDeps {
  env: Env;
  logger: Logger;
  mailer: Mailer;
  media: MediaService;
  lockout: LockoutStore;
  limiters: Limiters;
}

/** Cookie-authenticated endpoints: reject cross-origin browser requests (defence in depth on top of SameSite=Strict). */
function trustedOrigin(env: Env): RequestHandler {
  return (req, _res, next) => {
    const origin = req.get('origin');
    if (origin && !env.WEB_URL.includes(origin))
      return next(AppError.forbidden('Origin not allowed'));
    next();
  };
}

export function authRouter({
  env,
  logger,
  mailer,
  media,
  lockout,
  limiters,
}: AuthRouterDeps): Router {
  const router = Router();
  const auth = requireAuth(env);

  router.post(
    '/register',
    limiters.register,
    validate({ body: registerSchema }),
    asyncHandler(async (req, res) => {
      const input = req.body as z.output<typeof registerSchema>;
      if (await User.exists({ email: input.email })) {
        throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
      }
      const user = await User.create({
        name: input.name,
        email: input.email,
        phone: input.phone,
        passwordHash: await hashPassword(input.password, env.BCRYPT_ROUNDS),
        role: 'customer', // operators/admins are never created through public signup
      });
      const result = await issueSession(env, req, res, user);
      res.status(201).json({ data: result } satisfies ApiSuccess<AuthResult>);
    }),
  );

  /** Operator self-signup (/register/operator): account + profile in `pending` until an admin approves. */
  router.post(
    '/register/operator',
    limiters.register,
    validate({ body: operatorRegisterSchema }),
    asyncHandler(async (req, res) => {
      const { name, email, password, ...profile } = req.body as z.output<
        typeof operatorRegisterSchema
      >;
      const { user } = await createOperatorAccount({
        name,
        email,
        password,
        bcryptRounds: env.BCRYPT_ROUNDS,
        profile,
        status: 'pending',
        cloudName: media.cloudName,
      });
      const result = await issueSession(env, req, res, user);
      res.status(201).json({ data: result } satisfies ApiSuccess<AuthResult>);
    }),
  );

  router.post(
    '/login',
    validate({ body: loginSchema }),
    limiters.login,
    asyncHandler(async (req, res) => {
      const { email, password } = req.body as z.output<typeof loginSchema>;

      const lockedMs = await lockout.lockedFor(email);
      if (lockedMs > 0) {
        res.set('Retry-After', String(Math.ceil(lockedMs / 1000)));
        throw new AppError(
          429,
          'ACCOUNT_LOCKED',
          'Too many failed attempts. Try again in 15 minutes or reset your password.',
        );
      }

      const user = await User.findOne({ email }).select('+passwordHash');
      const ok = user
        ? await verifyPassword(password, user.passwordHash)
        : await burnPasswordCheck(password, env.BCRYPT_ROUNDS);

      if (!user || !ok) {
        const { lockedFor } = await lockout.registerFailure(email);
        if (lockedFor > 0) {
          logger.warn({ email }, 'Account locked after repeated failed logins');
          res.set('Retry-After', String(Math.ceil(lockedFor / 1000)));
          throw new AppError(
            429,
            'ACCOUNT_LOCKED',
            'Too many failed attempts. Try again in 15 minutes or reset your password.',
          );
        }
        throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
      }

      await lockout.reset(email);
      const result = await issueSession(env, req, res, user);
      res.json({ data: result } satisfies ApiSuccess<AuthResult>);
    }),
  );

  router.post(
    '/refresh',
    trustedOrigin(env),
    asyncHandler(async (req, res) => {
      const raw: unknown = req.cookies?.[REFRESH_COOKIE];
      const fail = (code = 'REFRESH_INVALID') => {
        clearRefreshCookie(env, res);
        return new AppError(401, code, 'Please log in again');
      };
      if (typeof raw !== 'string' || !raw) throw new AppError(401, 'NO_SESSION', 'Not logged in');

      let claims;
      try {
        claims = verifyRefreshToken(env, raw);
      } catch {
        throw fail();
      }

      const user = await User.findById(claims.sub);
      if (!user || user.refreshTokenVersion !== claims.ver) throw fail();

      // Atomically claim the token so two concurrent refreshes can't both succeed.
      const session = await RefreshSession.findOneAndUpdate(
        { jti: claims.jti, user: user._id, usedAt: null },
        { $set: { usedAt: new Date() } },
      );

      if (!session) {
        const previous = await RefreshSession.findOne({ jti: claims.jti }).lean();
        if (previous?.usedAt && Date.now() - previous.usedAt.getTime() < REFRESH_RACE_GRACE_MS) {
          // Another tab rotated this token a moment ago; the browser already holds the new cookie.
          throw new AppError(401, 'REFRESH_CONFLICT', 'Session refreshed elsewhere, retry');
        }
        // Reuse of an old token → assume theft: revoke every session of this user.
        logger.warn({ userId: user.id, family: claims.fam }, 'Refresh token reuse detected');
        await User.updateOne({ _id: user._id }, { $inc: { refreshTokenVersion: 1 } });
        await RefreshSession.deleteMany({ user: user._id });
        throw fail('REFRESH_REUSED');
      }

      const result = await issueSession(env, req, res, user, claims.fam);
      res.json({ data: result } satisfies ApiSuccess<AuthResult>);
    }),
  );

  router.post(
    '/logout',
    trustedOrigin(env),
    asyncHandler(async (req, res) => {
      const raw: unknown = req.cookies?.[REFRESH_COOKIE];
      if (typeof raw === 'string' && raw) {
        try {
          const claims = verifyRefreshToken(env, raw);
          await RefreshSession.deleteOne({ jti: claims.jti });
        } catch {
          // invalid/expired token — nothing to revoke
        }
      }
      clearRefreshCookie(env, res);
      res.json({ data: { ok: true } });
    }),
  );

  router.get(
    '/me',
    auth,
    asyncHandler(async (req, res) => {
      const user = await User.findById(req.auth!.userId);
      if (!user) throw AppError.unauthorized('Account no longer exists');
      res.json({ data: toPublicUser(user) } satisfies ApiSuccess<PublicUser>);
    }),
  );

  router.patch(
    '/me',
    auth,
    validate({ body: updateMeSchema }),
    asyncHandler(async (req, res) => {
      const user = await User.findByIdAndUpdate(
        req.auth!.userId,
        { $set: req.body as z.output<typeof updateMeSchema> },
        { new: true, runValidators: true },
      );
      if (!user) throw AppError.unauthorized('Account no longer exists');
      res.json({ data: toPublicUser(user) } satisfies ApiSuccess<PublicUser>);
    }),
  );

  router.post(
    '/forgot-password',
    validate({ body: forgotPasswordSchema }),
    limiters.passwordReset,
    asyncHandler(async (req, res) => {
      const { email } = req.body as z.output<typeof forgotPasswordSchema>;
      const user = await User.findOne({ email });
      if (user) {
        const { token, hash } = createOpaqueToken();
        await User.updateOne(
          { _id: user._id },
          {
            passwordResetTokenHash: hash,
            passwordResetExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
          },
        );
        const link = `${env.WEB_URL[0]}/reset-password?token=${encodeURIComponent(token)}`;
        await mailer.send({
          to: user.email,
          subject: 'Reset your Video Lamhe password',
          text:
            `Assalam o Alaikum ${user.name},\n\n` +
            `Use this link to set a new password (valid for 30 minutes):\n${link}\n\n` +
            `If you didn't ask for this, you can ignore this email.\n\n— Video Lamhe`,
        });
      }
      // Same response either way so emails can't be enumerated.
      res.json({
        data: {
          ok: true,
          message: 'If an account exists for this email, a reset link has been sent.',
        },
      });
    }),
  );

  router.post(
    '/reset-password',
    limiters.passwordReset,
    validate({ body: resetPasswordSchema }),
    asyncHandler(async (req, res) => {
      const { token, password } = req.body as z.output<typeof resetPasswordSchema>;
      const user = await User.findOneAndUpdate(
        { passwordResetTokenHash: sha256(token), passwordResetExpiresAt: { $gt: new Date() } },
        {
          $set: {
            passwordHash: await hashPassword(password, env.BCRYPT_ROUNDS),
            passwordResetTokenHash: null,
            passwordResetExpiresAt: null,
          },
          $inc: { refreshTokenVersion: 1 }, // log out everywhere
        },
        { new: true },
      );
      if (!user)
        throw new AppError(400, 'RESET_TOKEN_INVALID', 'This reset link is invalid or has expired');
      await RefreshSession.deleteMany({ user: user._id });
      await lockout.reset(user.email);
      res.json({ data: { ok: true } });
    }),
  );

  return router;
}
