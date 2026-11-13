import { Router } from 'express';
import {
  adminOperatorCreateSchema,
  adminOperatorListQuerySchema,
  adminOperatorUpdateSchema,
  objectIdSchema,
  operatorDronesReplaceSchema,
  operatorStatusUpdateSchema,
} from '@video-lamhe/shared';
import { Types } from 'mongoose';
import { z } from 'zod';
import type { Env } from '../../config/env.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { AppError } from '../../lib/errors.js';
import type { Mailer } from '../../lib/mailer.js';
import type { MediaService } from '../../lib/media.js';
import type { Logger } from 'pino';
import { validate } from '../../middleware/validate.js';
import { Operator } from '../../models/Operator.js';
import { getManagedOperator, listManagedOperators } from '../../services/catalog.js';
import { sendOperatorInvite } from '../../services/invite.js';
import {
  buildProfileUpdate,
  cleanupReplacedPhoto,
  createOperatorAccount,
  deleteOperator,
  replaceOperatorDrones,
  setOperatorStatus,
} from '../../services/operators.js';

const idParams = z.object({ id: objectIdSchema });

export function adminOperatorsRouter({
  env,
  mailer,
  media,
  logger,
}: {
  env: Env;
  mailer: Mailer;
  media: MediaService;
  logger: Logger;
}): Router {
  const router = Router();

  router.get(
    '/',
    validate({ query: adminOperatorListQuerySchema }),
    asyncHandler(async (req, res) => {
      const { items, meta } = await listManagedOperators(
        req.query as unknown as z.output<typeof adminOperatorListQuerySchema>,
      );
      res.json({ data: items, meta });
    }),
  );

  router.get(
    '/:id',
    validate({ params: idParams }),
    asyncHandler(async (req, res) => {
      res.json({ data: await getManagedOperator({ _id: req.params.id }) });
    }),
  );

  /** Admin "Add operator": creates the account and emails a set-password invite. */
  router.post(
    '/',
    validate({ body: adminOperatorCreateSchema }),
    asyncHandler(async (req, res) => {
      const { name, email, status, isVerified, drones, ...profile } = req.body as z.output<
        typeof adminOperatorCreateSchema
      >;
      const { user, operatorId } = await createOperatorAccount({
        name,
        email,
        bcryptRounds: env.BCRYPT_ROUNDS,
        profile,
        status,
        isVerified,
        drones,
        cloudName: media.cloudName,
      });
      await sendOperatorInvite(env, mailer, user, profile.businessName);
      res.status(201).json({ data: await getManagedOperator({ _id: operatorId }) });
    }),
  );

  router.patch(
    '/:id',
    validate({ params: idParams, body: adminOperatorUpdateSchema }),
    asyncHandler(async (req, res) => {
      const current = await Operator.findById(req.params.id)
        .select('baseCity serviceCities phone photoUrl')
        .lean();
      if (!current) throw AppError.notFound('Operator not found');
      const set = await buildProfileUpdate(
        req.body as z.output<typeof adminOperatorUpdateSchema>,
        current,
        media.cloudName,
      );
      await Operator.updateOne({ _id: current._id }, { $set: set });
      if ('photoUrl' in set) cleanupReplacedPhoto(media, logger, current.photoUrl, set.photoUrl);
      res.json({ data: await getManagedOperator({ _id: current._id }) });
    }),
  );

  router.put(
    '/:id/drones',
    validate({ params: idParams, body: operatorDronesReplaceSchema }),
    asyncHandler(async (req, res) => {
      const id = new Types.ObjectId(req.params.id as string);
      if (!(await Operator.exists({ _id: id }))) throw AppError.notFound('Operator not found');
      await replaceOperatorDrones(
        id,
        (req.body as z.output<typeof operatorDronesReplaceSchema>).drones,
      );
      res.json({ data: await getManagedOperator({ _id: id }) });
    }),
  );

  /** Approve (pending → active), deactivate (→ inactive, logs them out) or reactivate. */
  router.patch(
    '/:id/status',
    validate({ params: idParams, body: operatorStatusUpdateSchema }),
    asyncHandler(async (req, res) => {
      const { status } = req.body as z.output<typeof operatorStatusUpdateSchema>;
      await setOperatorStatus(req.params.id as string, status);
      res.json({ data: await getManagedOperator({ _id: req.params.id }) });
    }),
  );

  router.delete(
    '/:id',
    validate({ params: idParams }),
    asyncHandler(async (req, res) => {
      await deleteOperator(req.params.id as string, media, logger);
      res.json({ data: { ok: true } });
    }),
  );

  return router;
}
