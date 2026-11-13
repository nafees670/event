import { Router } from 'express';
import type { HealthStatus, ReadyStatus } from '@video-lamhe/shared';
import { asyncHandler } from '../lib/asyncHandler.js';

export type ReadinessCheck = () => Promise<ReadyStatus['checks']>;

export function healthRouter(checkReadiness: ReadinessCheck): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    const body: HealthStatus = {
      status: 'ok',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
    res.set('Cache-Control', 'no-store').json({ data: body });
  });

  router.get(
    '/ready',
    asyncHandler(async (_req, res) => {
      const checks = await checkReadiness();
      const ok = Object.values(checks).every((c) => c !== 'down');
      const body: ReadyStatus = { status: ok ? 'ready' : 'not_ready', checks };
      res
        .status(ok ? 200 : 503)
        .set('Cache-Control', 'no-store')
        .json({ data: body });
    }),
  );

  return router;
}
