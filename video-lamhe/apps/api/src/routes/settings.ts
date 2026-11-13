import { Router } from 'express';
import type { ApiSuccess, ContactSettings } from '@video-lamhe/shared';
import type { Env } from '../config/env.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { getContactSettings } from '../services/contactSettings.js';

/** Public settings. Never includes phone numbers. */
export function settingsRouter({ env }: { env: Env }): Router {
  const router = Router();

  router.get(
    '/contact',
    asyncHandler(async (_req, res) => {
      const { welcomeTitle, welcomeSubtitle, eventOptions } = await getContactSettings(env);
      res.set('Cache-Control', 'public, max-age=300').json({
        data: { welcomeTitle, welcomeSubtitle, eventOptions },
      } satisfies ApiSuccess<ContactSettings>);
    }),
  );

  return router;
}
