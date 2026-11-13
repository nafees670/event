import { Router, type RequestHandler } from 'express';
import {
  uploadSignatureQuerySchema,
  type ApiSuccess,
  type Role,
  type UploadSignature,
  type UploadType,
} from '@video-lamhe/shared';
import type { z } from 'zod';
import type { Env } from '../config/env.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { AppError } from '../lib/errors.js';
import { UPLOAD_RULES, folderFor, type MediaService } from '../lib/media.js';
import { requireAuth } from '../middleware/auth.js';
import type { Limiters } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';

/** Who may request a signature for each upload kind. */
const ALLOWED: Record<UploadType, Role[]> = {
  short: ['operator', 'admin'],
  avatar: ['operator', 'admin'],
  drone: ['admin'],
  hero: ['admin'],
};

export function uploadsRouter({
  env,
  media,
  limiters,
}: {
  env: Env;
  media: MediaService;
  limiters: Limiters;
}): Router {
  const router = Router();

  // Admins get the higher limit (200/h) — chosen after auth so we know the role.
  const signatureLimit: RequestHandler = (req, res, next) =>
    (req.auth?.role === 'admin' ? limiters.uploadSignatureAdmin : limiters.uploadSignature)(
      req,
      res,
      next,
    );

  /**
   * Signed direct-upload params (Section 8.2). The browser posts the file straight to Cloudinary;
   * the API never streams media. The signature pins the uploader's own folder.
   */
  router.get(
    '/signature',
    requireAuth(env),
    signatureLimit,
    validate({ query: uploadSignatureQuerySchema }),
    asyncHandler(async (req, res) => {
      const { type } = req.query as unknown as z.output<typeof uploadSignatureQuerySchema>;
      if (!ALLOWED[type].includes(req.auth!.role)) throw AppError.forbidden();
      const rule = UPLOAD_RULES[type];
      const timestamp = Math.round(Date.now() / 1000);
      const folder = folderFor(type, req.auth!.userId);
      const { signature, apiKey, cloudName } = media.sign({ folder, timestamp });
      const data: UploadSignature = {
        type,
        uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/${rule.resourceType}/upload`,
        cloudName,
        apiKey,
        timestamp,
        signature,
        folder,
        resourceType: rule.resourceType,
        maxBytes: rule.maxBytes,
        maxSeconds: rule.maxSeconds,
      };
      res.set('Cache-Control', 'no-store').json({ data } satisfies ApiSuccess<UploadSignature>);
    }),
  );

  return router;
}
