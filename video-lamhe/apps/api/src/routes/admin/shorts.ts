import { Router } from 'express';
import type { Logger } from 'pino';
import {
  adminShortCreateSchema,
  adminShortListQuerySchema,
  adminShortUpdateSchema,
  objectIdSchema,
} from '@video-lamhe/shared';
import { z } from 'zod';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { AppError } from '../../lib/errors.js';
import type { MediaService } from '../../lib/media.js';
import { validate } from '../../middleware/validate.js';
import { Short } from '../../models/Short.js';
import {
  buildShortUpdate,
  createShortFromUpload,
  deleteShort,
  getManagedShort,
  listManagedShorts,
} from '../../services/shorts.js';

const idParams = z.object({ id: objectIdSchema });

export function adminShortsRouter({
  media,
  logger,
}: {
  media: MediaService;
  logger: Logger;
}): Router {
  const router = Router();

  router.get(
    '/',
    validate({ query: adminShortListQuerySchema }),
    asyncHandler(async (req, res) => {
      const { items, meta } = await listManagedShorts(
        req.query as unknown as z.output<typeof adminShortListQuerySchema>,
      );
      res.json({ data: items, meta });
    }),
  );

  /** Admin upload on behalf of an operator (published or draft). */
  router.post(
    '/',
    validate({ body: adminShortCreateSchema }),
    asyncHandler(async (req, res) => {
      const { publicId, operator, status, isFeatured, ...meta } = req.body as z.output<
        typeof adminShortCreateSchema
      >;
      const short = await createShortFromUpload({
        media,
        logger,
        uploaderId: req.auth!.userId,
        operatorId: operator,
        publicId,
        meta,
        status,
        isFeatured,
      });
      res.status(201).json({ data: short });
    }),
  );

  /** Approve / reject / feature / edit. */
  router.patch(
    '/:id',
    validate({ params: idParams, body: adminShortUpdateSchema }),
    asyncHandler(async (req, res) => {
      const input = req.body as z.output<typeof adminShortUpdateSchema>;
      const current = await Short.findById(req.params.id).select('status publishedAt').lean();
      if (!current) throw AppError.notFound('Short not found');

      const set = await buildShortUpdate(input);
      const status = input.status ?? current.status;
      if (input.status) {
        set.status = input.status;
        if (input.status === 'published' && !current.publishedAt) set.publishedAt = new Date();
      }
      // A reason only makes sense on a rejected short.
      set.rejectionReason = status === 'rejected' ? (input.rejectionReason ?? null) : null;
      if (input.isFeatured !== undefined) set.isFeatured = input.isFeatured;
      if (status !== 'published') set.isFeatured = false;

      await Short.updateOne({ _id: current._id }, { $set: set });
      res.json({ data: await getManagedShort(current._id) });
    }),
  );

  router.delete(
    '/:id',
    validate({ params: idParams }),
    asyncHandler(async (req, res) => {
      await deleteShort(req.params.id as string, media, logger);
      res.json({ data: { ok: true } });
    }),
  );

  return router;
}
