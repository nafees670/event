import { Router } from 'express';
import type { Logger } from 'pino';
import {
  objectIdSchema,
  operatorDroneInputSchema,
  operatorDroneUpdateSchema,
  operatorSelfUpdateSchema,
  shortCreateSchema,
  shortUpdateSchema,
} from '@video-lamhe/shared';
import { z } from 'zod';
import type { Env } from '../config/env.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { AppError } from '../lib/errors.js';
import type { MediaService } from '../lib/media.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { Operator } from '../models/Operator.js';
import { OperatorDrone } from '../models/OperatorDrone.js';
import { Short } from '../models/Short.js';
import {
  assertDroneModelsExist,
  getManagedOperator,
  recomputePriceFrom,
} from '../services/catalog.js';
import { buildProfileUpdate, cleanupReplacedPhoto } from '../services/operators.js';
import {
  buildShortUpdate,
  createShortFromUpload,
  deleteShort,
  getManagedShort,
  listManagedShorts,
} from '../services/shorts.js';

const idParams = z.object({ id: objectIdSchema });

/** The logged-in operator's own profile, drones and shorts (/operator/*). */
export function operatorSelfRouter({
  env,
  media,
  logger,
}: {
  env: Env;
  media: MediaService;
  logger: Logger;
}): Router {
  const router = Router();
  router.use(requireAuth(env), requireRole('operator'));

  const myOperator = async (userId: string) => {
    const op = await Operator.findOne({ user: userId })
      .select('_id baseCity serviceCities phone photoUrl')
      .lean();
    if (!op) throw AppError.notFound('Operator profile not found');
    return op;
  };

  router.get(
    '/me',
    asyncHandler(async (req, res) => {
      res.json({ data: await getManagedOperator({ user: req.auth!.userId }) });
    }),
  );

  router.patch(
    '/me',
    validate({ body: operatorSelfUpdateSchema }),
    asyncHandler(async (req, res) => {
      const op = await myOperator(req.auth!.userId);
      // Status, verification, rating and slug are admin/system-controlled — not in the schema.
      const set = await buildProfileUpdate(
        req.body as z.output<typeof operatorSelfUpdateSchema>,
        op,
        media.cloudName,
      );
      await Operator.updateOne({ _id: op._id }, { $set: set });
      if ('photoUrl' in set) cleanupReplacedPhoto(media, logger, op.photoUrl, set.photoUrl);
      res.json({ data: await getManagedOperator({ _id: op._id }) });
    }),
  );

  router.post(
    '/drones',
    validate({ body: operatorDroneInputSchema }),
    asyncHandler(async (req, res) => {
      const op = await myOperator(req.auth!.userId);
      const input = req.body as z.output<typeof operatorDroneInputSchema>;
      await assertDroneModelsExist([input.model]);
      if (await OperatorDrone.exists({ operator: op._id, model: input.model })) {
        throw new AppError(409, 'DUPLICATE_DRONE', 'You already listed this drone');
      }
      await OperatorDrone.create({ ...input, operator: op._id });
      await recomputePriceFrom(op._id);
      res.status(201).json({ data: await getManagedOperator({ _id: op._id }) });
    }),
  );

  router.patch(
    '/drones/:id',
    validate({ params: idParams, body: operatorDroneUpdateSchema }),
    asyncHandler(async (req, res) => {
      const op = await myOperator(req.auth!.userId);
      const input = req.body as z.output<typeof operatorDroneUpdateSchema>;
      const set: Record<string, unknown> = { ...input };
      for (const key of ['pricePerEvent', 'pricePerHour'] as const) {
        if (key in input && input[key] === undefined) set[key] = null; // sent empty/null → clear
      }
      const r = await OperatorDrone.updateOne(
        { _id: req.params.id, operator: op._id }, // ownership check
        { $set: set },
      );
      if (!r.matchedCount) throw AppError.notFound('Drone not found');
      await recomputePriceFrom(op._id);
      res.json({ data: await getManagedOperator({ _id: op._id }) });
    }),
  );

  router.delete(
    '/drones/:id',
    validate({ params: idParams }),
    asyncHandler(async (req, res) => {
      const op = await myOperator(req.auth!.userId);
      const r = await OperatorDrone.deleteOne({ _id: req.params.id, operator: op._id });
      if (!r.deletedCount) throw AppError.notFound('Drone not found');
      await recomputePriceFrom(op._id);
      res.json({ data: await getManagedOperator({ _id: op._id }) });
    }),
  );

  // ---------- my shorts ----------

  router.get(
    '/shorts',
    asyncHandler(async (req, res) => {
      const op = await myOperator(req.auth!.userId);
      const { items } = await listManagedShorts({ operator: op._id, page: 1, limit: 60 });
      res.json({ data: items });
    }),
  );

  /** Upload → always pending until an admin approves (Phase 3 flow). */
  router.post(
    '/shorts',
    validate({ body: shortCreateSchema }),
    asyncHandler(async (req, res) => {
      const op = await myOperator(req.auth!.userId);
      const { publicId, ...meta } = req.body as z.output<typeof shortCreateSchema>;
      const short = await createShortFromUpload({
        media,
        logger,
        uploaderId: req.auth!.userId,
        operatorId: op._id,
        publicId,
        meta,
        status: 'pending',
      });
      res.status(201).json({ data: short });
    }),
  );

  /** Edit while not yet published; a rejected short goes back to the review queue. */
  router.patch(
    '/shorts/:id',
    validate({ params: idParams, body: shortUpdateSchema }),
    asyncHandler(async (req, res) => {
      const op = await myOperator(req.auth!.userId);
      const short = await Short.findOne({ _id: req.params.id, operator: op._id })
        .select('status')
        .lean();
      if (!short) throw AppError.notFound('Short not found');
      if (short.status === 'published') {
        throw new AppError(
          409,
          'SHORT_PUBLISHED',
          'Published shorts can’t be edited — delete and upload again',
        );
      }
      const set = await buildShortUpdate(req.body as z.output<typeof shortUpdateSchema>);
      await Short.updateOne(
        { _id: short._id },
        { $set: { ...set, status: 'pending', rejectionReason: null } },
      );
      res.json({ data: await getManagedShort(short._id) });
    }),
  );

  router.delete(
    '/shorts/:id',
    validate({ params: idParams }),
    asyncHandler(async (req, res) => {
      const op = await myOperator(req.auth!.userId);
      const short = await Short.exists({ _id: req.params.id, operator: op._id });
      if (!short) throw AppError.notFound('Short not found');
      await deleteShort(short._id, media, logger);
      res.json({ data: { ok: true } });
    }),
  );

  return router;
}
