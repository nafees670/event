import { Router } from 'express';
import type { Env } from '../../config/env.js';
import type { Logger } from 'pino';
import type { Mailer } from '../../lib/mailer.js';
import type { MediaService } from '../../lib/media.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import type { Limiters } from '../../middleware/rateLimit.js';
import { adminCitiesRouter } from './cities.js';
import { adminDronesRouter } from './drones.js';
import { adminOperatorsRouter } from './operators.js';
import { adminShortsRouter } from './shorts.js';

/** Everything under /admin: login + admin role + admin rate limit. */
export function adminRouter(deps: {
  env: Env;
  mailer: Mailer;
  limiters: Limiters;
  media: MediaService;
  logger: Logger;
}): Router {
  const router = Router();
  router.use(requireAuth(deps.env), requireRole('admin'), deps.limiters.admin);
  router.use('/cities', adminCitiesRouter());
  router.use('/drones', adminDronesRouter(deps));
  router.use('/operators', adminOperatorsRouter(deps));
  router.use('/shorts', adminShortsRouter(deps));
  return router;
}
