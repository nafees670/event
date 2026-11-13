import { Router } from 'express';
import {
  buildWaMessage,
  waLink,
  whatsappContactSchema,
  type ApiSuccess,
  type WhatsappContactResult,
} from '@video-lamhe/shared';
import type { z } from 'zod';
import type { Env } from '../config/env.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import type { Limiters } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { getActiveOperatorContact } from '../services/catalog.js';
import { getContactSettings } from '../services/contactSettings.js';

/** '2026-12-12' → '12 Dec 2026' */
function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Contact endpoints (Section 2.1) — every one requires login. Numbers are only ever
 * returned from here (and GET /operators/:slug/contact), never from public endpoints.
 */
export function contactRouter({ env, limiters }: { env: Env; limiters: Limiters }): Router {
  const router = Router();
  router.use(requireAuth(env));

  /**
   * Every WhatsApp button on the site calls this after the welcome picker.
   * routing=admin (current): the business number; the message names the operator.
   * routing=operator: the operator's own WhatsApp.
   * TODO(Phase 5): log an Inquiry { source: 'whatsapp' }.
   */
  router.post(
    '/whatsapp',
    limiters.contactReveal,
    validate({ body: whatsappContactSchema }),
    asyncHandler(async (req, res) => {
      const input = req.body as z.output<typeof whatsappContactSchema>;
      const settings = await getContactSettings(env);

      let number = settings.whatsappNumber;
      let operatorName = input.operatorName;
      if (input.operatorSlug) {
        // Never trust the client's label: the name in the message comes from the DB.
        const op = await getActiveOperatorContact(input.operatorSlug);
        operatorName = op.businessName;
        if (settings.routing === 'operator') number = op.whatsapp;
      }

      const eventLabel = settings.eventOptions.find((o) => o.value === input.eventType)?.label;
      const message = buildWaMessage({
        eventLabel,
        operatorName,
        droneName: input.droneName,
        cityName: input.cityName,
        date: input.eventDate ? formatDate(input.eventDate) : undefined,
        note: input.note,
      });
      const data: WhatsappContactResult = { whatsapp: number, waLink: waLink(number, message) };
      res
        .set('Cache-Control', 'no-store')
        .json({ data } satisfies ApiSuccess<WhatsappContactResult>);
    }),
  );

  /** Admin WhatsApp link without picker context ("Don't see your city? Contact us"). */
  router.get(
    '/admin',
    limiters.contactReveal,
    asyncHandler(async (_req, res) => {
      const settings = await getContactSettings(env);
      const data: WhatsappContactResult = {
        whatsapp: settings.whatsappNumber,
        waLink: waLink(settings.whatsappNumber, buildWaMessage({})),
      };
      res
        .set('Cache-Control', 'no-store')
        .json({ data } satisfies ApiSuccess<WhatsappContactResult>);
    }),
  );

  return router;
}
