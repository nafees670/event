import { Router, type Response } from 'express';
import {
  buildWaMessage,
  droneDetailQuerySchema,
  droneListQuerySchema,
  operatorListQuerySchema,
  slugSchema,
  waLink,
  type ApiSuccess,
  type OperatorContactResult,
} from '@video-lamhe/shared';
import { z } from 'zod';
import type { Env } from '../config/env.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import type { Limiters } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import {
  getActiveOperatorContact,
  getDroneDetail,
  getPublicCity,
  getPublicOperator,
  listCities,
  listDroneModels,
  listPublicOperators,
} from '../services/catalog.js';
import { getContactSettings } from '../services/contactSettings.js';

const slugParams = z.object({ slug: slugSchema });

/** Short browser/CDN cache; Next.js ISR adds its own layer. Redis cache arrives in Phase 8. */
const publicCache = (res: Response) =>
  res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');

/** Public catalogue. No phone/WhatsApp numbers anywhere except the auth-only /contact route. */
export function catalogRouter({ env, limiters }: { env: Env; limiters: Limiters }): Router {
  const router = Router();

  router.get(
    '/cities',
    asyncHandler(async (_req, res) => {
      const cities = await listCities({ includeInactive: false });
      const data = cities.map(({ isActive: _a, ...c }) => c);
      publicCache(res).json({ data } satisfies ApiSuccess<typeof data>);
    }),
  );

  router.get(
    '/cities/:slug',
    validate({ params: slugParams }),
    asyncHandler(async (req, res) => {
      const data = await getPublicCity(req.params.slug as string);
      publicCache(res).json({ data });
    }),
  );

  router.get(
    '/drones',
    validate({ query: droneListQuerySchema }),
    asyncHandler(async (req, res) => {
      const models = await listDroneModels(
        req.query as unknown as z.output<typeof droneListQuerySchema>,
      );
      const data = models.map(({ sortOrder: _s, ...m }) => m);
      publicCache(res).json({ data });
    }),
  );

  router.get(
    '/drones/:slug',
    validate({ params: slugParams, query: droneDetailQuerySchema }),
    asyncHandler(async (req, res) => {
      const { city } = req.query as z.output<typeof droneDetailQuerySchema>;
      const data = await getDroneDetail(req.params.slug as string, city);
      publicCache(res).json({ data });
    }),
  );

  router.get(
    '/operators',
    validate({ query: operatorListQuerySchema }),
    asyncHandler(async (req, res) => {
      const { items, meta } = await listPublicOperators(
        req.query as unknown as z.output<typeof operatorListQuerySchema>,
      );
      publicCache(res).json({ data: items, meta });
    }),
  );

  router.get(
    '/operators/:slug',
    validate({ params: slugParams }),
    asyncHandler(async (req, res) => {
      const data = await getPublicOperator(req.params.slug as string);
      publicCache(res).json({ data });
    }),
  );

  /**
   * Call / number reveal (Section 2.1) — login required, rate-limited.
   * routing=admin: returns the Video Lamhe number so operator numbers stay private.
   * TODO(Phase 5): log an Inquiry { source: 'call' }.
   */
  router.get(
    '/operators/:slug/contact',
    requireAuth(env),
    limiters.contactReveal,
    validate({ params: slugParams }),
    asyncHandler(async (req, res) => {
      const op = await getActiveOperatorContact(req.params.slug as string);
      const settings = await getContactSettings(env);
      const toOperator = settings.routing === 'operator';
      const phone = toOperator ? op.phone : settings.whatsappNumber;
      const whatsapp = toOperator ? op.whatsapp : settings.whatsappNumber;
      const data: OperatorContactResult = {
        phone,
        whatsapp,
        waLink: waLink(
          whatsapp,
          buildWaMessage({ operatorName: op.businessName, cityName: op.baseCity?.name }),
        ),
        routedTo: toOperator ? 'operator' : 'admin',
      };
      res
        .set('Cache-Control', 'no-store')
        .json({ data } satisfies ApiSuccess<OperatorContactResult>);
    }),
  );

  return router;
}
