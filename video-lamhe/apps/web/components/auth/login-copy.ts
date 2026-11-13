import type { ContactAction } from '@video-lamhe/shared';

const ACTION_COPY: Record<ContactAction, (name?: string) => string> = {
  whatsapp: (n) => (n ? `Log in to WhatsApp ${n}` : 'Log in to continue on WhatsApp'),
  chat: (n) => (n ? `Log in to chat with ${n}` : 'Log in to start a chat'),
  call: (n) => (n ? `Log in to call ${n}` : 'Log in to see the phone number'),
  book: (n) => (n ? `Log in to book ${n}` : 'Log in to send a booking request'),
  inquiry: () => 'Log in to send your inquiry',
  like: () => 'Log in to like this short',
  save: () => 'Log in to save this short',
};

export function loginHeading(action: string | null, operatorName?: string): string | null {
  if (!action || !(action in ACTION_COPY)) return null;
  return ACTION_COPY[action as ContactAction](operatorName);
}
