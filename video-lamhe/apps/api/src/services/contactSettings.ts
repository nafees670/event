import {
  DEFAULT_CONTACT_SETTINGS,
  WHATSAPP_ROUTINGS,
  toWaNumber,
  type ContactSettings,
  type WhatsappRouting,
} from '@video-lamhe/shared';
import type { Env } from '../config/env.js';
import { Setting } from '../models/Setting.js';

/** Stored in Setting { key: 'contact' }, editable from Admin → Settings → Contact (later phase). */
export interface StoredContactSettings extends Partial<ContactSettings> {
  whatsappNumber?: string;
  whatsappRouting?: WhatsappRouting;
}

export interface ResolvedContactSettings extends ContactSettings {
  whatsappNumber: string;
  /** 'admin' → every WhatsApp/call goes to the business number; 'operator' → the operator's own. */
  routing: WhatsappRouting;
}

export async function getContactSettings(env: Env): Promise<ResolvedContactSettings> {
  const doc = await Setting.findOne({ key: 'contact' }).lean();
  const stored = (doc?.value ?? {}) as StoredContactSettings;
  return {
    welcomeTitle: stored.welcomeTitle || DEFAULT_CONTACT_SETTINGS.welcomeTitle,
    welcomeSubtitle: stored.welcomeSubtitle || DEFAULT_CONTACT_SETTINGS.welcomeSubtitle,
    eventOptions: stored.eventOptions?.length
      ? stored.eventOptions
      : DEFAULT_CONTACT_SETTINGS.eventOptions,
    whatsappNumber:
      (stored.whatsappNumber && toWaNumber(stored.whatsappNumber)) || env.ADMIN_WHATSAPP,
    routing:
      stored.whatsappRouting && WHATSAPP_ROUTINGS.includes(stored.whatsappRouting)
        ? stored.whatsappRouting
        : env.WHATSAPP_ROUTING,
  };
}
