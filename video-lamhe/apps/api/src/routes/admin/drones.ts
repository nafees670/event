import { Router } from 'express';
import {
  droneModelCreateSchema,
  droneModelUpdateSchema,
  objectIdSchema,
} from '@video-lamhe/shared';
import { z } from 'zod';
import { asyncHandler } from '../../lib/asyncHandler.js';
import type { Logger } from 'pino';
import { AppError } from '../../lib/errors.js';
import {
  destroyLater,
  isOurAssetUrl,
  publicIdFromUrl,
  type MediaService,
} from '../../lib/media.js';
import { uniqueSlug } from '../../lib/slug.js';
import { validate } from '../../middleware/validate.js';
import { DroneModel } from '../../models/DroneModel.js';
import { OperatorDrone } from '../../models/OperatorDrone.js';
import { listAllDroneModels } from '../../services/catalog.js';

const idParams = z.object({ id: objectIdSchema });

export function adminDronesRouter({
  media,
  logger,
}: {
  media: MediaService;
  logger: Logger;
}): Router {
  const router = Router();

  /** Drone images must be uploads to our Cloudinary account. */
  const assertImages = (images?: string[]) => {
    if (images?.some((u) => !isOurAssetUrl(u, media.cloudName, 'image'))) {
      throw new AppError(400, 'INVALID_MEDIA', 'Upload drone images through Video Lamhe');
    }
  };

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      res.json({ data: await listAllDroneModels() });
    }),
  );

  router.post(
    '/',
    validate({ body: droneModelCreateSchema }),
    asyncHandler(async (req, res) => {
      const input = req.body as z.output<typeof droneModelCreateSchema>;
      assertImages(input.images);
      if (input.slug && (await DroneModel.exists({ slug: input.slug }))) {
        throw new AppError(409, 'SLUG_TAKEN', 'A drone with this slug already exists');
      }
      const model = await DroneModel.create({
        ...input,
        slug: input.slug ?? (await uniqueSlug(DroneModel, input.name)),
      });
      res.status(201).json({ data: { id: model.id as string } });
    }),
  );

  router.patch(
    '/:id',
    validate({ params: idParams, body: droneModelUpdateSchema }),
    asyncHandler(async (req, res) => {
      const input = req.body as z.output<typeof droneModelUpdateSchema>;
      assertImages(input.images);
      if (
        input.slug &&
        (await DroneModel.exists({ slug: input.slug, _id: { $ne: req.params.id } }))
      ) {
        throw new AppError(409, 'SLUG_TAKEN', 'A drone with this slug already exists');
      }
      const set: Record<string, unknown> = { ...input };
      for (const key of ['tag', 'bestFor'] as const) {
        if (key in input && input[key] === undefined) set[key] = null; // sent empty → clear
      }
      const before = await DroneModel.findByIdAndUpdate(
        req.params.id,
        { $set: set },
        { new: false },
      );
      if (!before) throw AppError.notFound('Drone not found');
      // Delete images that were removed from the gallery.
      if (input.images) {
        for (const url of before.images.filter((u) => !input.images!.includes(u))) {
          destroyLater(media, logger, publicIdFromUrl(url), 'image');
        }
      }
      res.json({ data: { id: before.id as string } });
    }),
  );

  router.delete(
    '/:id',
    validate({ params: idParams }),
    asyncHandler(async (req, res) => {
      if (await OperatorDrone.exists({ model: req.params.id })) {
        throw new AppError(
          409,
          'DRONE_IN_USE',
          'Operators list this drone — remove it from them first',
        );
      }
      const drone = await DroneModel.findByIdAndDelete(req.params.id);
      if (!drone) throw AppError.notFound('Drone not found');
      for (const url of drone.images) destroyLater(media, logger, publicIdFromUrl(url), 'image');
      res.json({ data: { ok: true } });
    }),
  );

  return router;
}
