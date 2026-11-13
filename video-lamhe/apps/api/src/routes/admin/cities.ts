import { Router } from 'express';
import { cityCreateSchema, cityUpdateSchema, objectIdSchema } from '@video-lamhe/shared';
import { z } from 'zod';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { AppError } from '../../lib/errors.js';
import { uniqueSlug } from '../../lib/slug.js';
import { validate } from '../../middleware/validate.js';
import { City } from '../../models/City.js';
import { Operator } from '../../models/Operator.js';
import { listCities } from '../../services/catalog.js';

const idParams = z.object({ id: objectIdSchema });

export function adminCitiesRouter(): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      res.json({ data: await listCities({ includeInactive: true }) });
    }),
  );

  router.post(
    '/',
    validate({ body: cityCreateSchema }),
    asyncHandler(async (req, res) => {
      const input = req.body as z.output<typeof cityCreateSchema>;
      if (input.slug && (await City.exists({ slug: input.slug }))) {
        throw new AppError(409, 'SLUG_TAKEN', 'A city with this slug already exists');
      }
      const city = await City.create({
        ...input,
        slug: input.slug ?? (await uniqueSlug(City, input.name)),
      });
      res.status(201).json({ data: { id: city.id as string } });
    }),
  );

  router.patch(
    '/:id',
    validate({ params: idParams, body: cityUpdateSchema }),
    asyncHandler(async (req, res) => {
      const input = req.body as z.output<typeof cityUpdateSchema>;
      if (input.slug && (await City.exists({ slug: input.slug, _id: { $ne: req.params.id } }))) {
        throw new AppError(409, 'SLUG_TAKEN', 'A city with this slug already exists');
      }
      const city = await City.findByIdAndUpdate(req.params.id, { $set: input }, { new: true });
      if (!city) throw AppError.notFound('City not found');
      res.json({ data: { id: city.id as string } });
    }),
  );

  router.delete(
    '/:id',
    validate({ params: idParams }),
    asyncHandler(async (req, res) => {
      const id = req.params.id as string;
      if (await Operator.exists({ $or: [{ baseCity: id }, { serviceCities: id }] })) {
        throw new AppError(
          409,
          'CITY_IN_USE',
          'Operators use this city — deactivate it instead of deleting',
        );
      }
      const r = await City.deleteOne({ _id: id });
      if (!r.deletedCount) throw AppError.notFound('City not found');
      res.json({ data: { ok: true } });
    }),
  );

  return router;
}
