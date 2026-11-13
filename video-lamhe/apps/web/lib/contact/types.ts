import type { ContactAction } from '@video-lamhe/shared';

/** What the user clicked from — used for the login context line and the WhatsApp message. */
export interface ContactContext {
  operatorSlug?: string;
  operatorName?: string;
  droneName?: string;
  cityName?: string;
  /** For like/save actions on a short. */
  shortId?: string;
}

export interface ContactRequest {
  action: ContactAction;
  context?: ContactContext;
}

export interface PendingAction extends ContactRequest {
  returnTo: string;
  createdAt: number;
}
