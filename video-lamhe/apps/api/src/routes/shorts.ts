import { Router, type Response } from 'express';
import { objectIdSchema, shortFeedQuerySchema } from '@video-lamhe/shared';
import { z } from 'zod';
import type { Env } from '../config/env.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import type { Limiters } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import {
  engagementFor,
  getPublicShort,
  listFeed,
  listSaved,
  recordView,
  setLike,
  setSaved,
} from '../services/shorts.js';

const idParams = z.object({ id: objectIdSchema });
const engagementQuery = z.object({
  ids: z
    .string()
    .max(50 * 25)
    .transform((v) => v.split(',').filter(Boolean))
    .pipe(z.array(objectIdSchema).min(1).max(50)),
});

/** Public, viewer-independent → cacheable. Viewer state comes from /shorts/engagement. */
const feedCache = (res: Response) =>
  res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');

export function shortsRouter({ env, limiters }: { env: Env; limiters: Limiters }): Router {
  const router = Router();
  const auth = requireAuth(env);

  router.get(
    '/',
    validate({ query: shortFeedQuerySchema }),
    asyncHandler(async (req, res) => {
      const { items, nextCursor } = await listFeed(
        req.query as unknown as z.output<typeof shortFeedQuerySchema>,
      );
      feedCache(res).json({ data: items, meta: { nextCursor } });
    }),
  );

  // Static paths before '/:id'.
  router.get(
    '/engagement',
    auth,
    validate({ query: engagementQuery }),
    asyncHandler(async (req, res) => {
      const { ids } = req.query as unknown as z.output<typeof engagementQuery>;
      res
        .set('Cache-Control', 'no-store')
        .json({ data: await engagementFor(req.auth!.userId, ids) });
    }),
  );

  router.get(
    '/saved',
    auth,
    asyncHandler(async (req, res) => {
      res.set('Cache-Control', 'no-store').json({ data: await listSaved(req.auth!.userId) });
    }),
  );

  router.get(
    '/:id',
    validate({ params: idParams }),
    asyncHandler(async (req, res) => {
      feedCache(res).json({ data: await getPublicShort(req.params.id as string) });
    }),
  );

  router.post(
    '/:id/view',
    optionalAuth(env),
    limiters.engagement,
    validate({ params: idParams }),
    asyncHandler(async (req, res) => {
      await recordView(req.params.id as string);
      res.json({ data: { ok: true } });
    }),
  );

  // Like / save — contact-gated in the UI, enforced here (Section 2.1).
  for (const [path, fn] of [
    ['like', setLike],
    ['save', setSaved],
  ] as const) {
    router.post(
      `/:id/${path}`,
      auth,
      limiters.engagement,
      validate({ params: idParams }),
      asyncHandler(async (req, res) => {
        res.json({ data: await fn(req.params.id as string, req.auth!.userId, true) });
      }),
    );
    router.delete(
      `/:id/${path}`,
      auth,
      limiters.engagement,
      validate({ params: idParams }),
      asyncHandler(async (req, res) => {
        res.json({ data: await fn(req.params.id as string, req.auth!.userId, false) });
      }),
    );
  }

  return router;
}
