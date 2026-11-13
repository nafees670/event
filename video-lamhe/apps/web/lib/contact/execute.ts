import { toast } from 'sonner';
import type { OperatorContactResult } from '@video-lamhe/shared';
import { ApiError, api } from '@/lib/api/client';
import { setShortLiked, setShortSaved } from '@/lib/shorts/engagement';
import { useCallSheet } from '@/stores/call-sheet';
import { useShortEngagement } from '@/stores/short-engagement';
import { useWhatsappPicker } from '@/stores/whatsapp-picker';
import type { ContactRequest } from './types';

async function revealNumber(req: ContactRequest) {
  const slug = req.context?.operatorSlug;
  if (!slug) return;
  try {
    const contact = await api<OperatorContactResult>(
      `/operators/${encodeURIComponent(slug)}/contact`,
    );
    useCallSheet.getState().show(req.context?.operatorName, contact);
  } catch (err) {
    if (!(err instanceof ApiError && err.code === 'RATE_LIMITED')) {
      toast.error(
        err instanceof ApiError ? err.message : 'Could not load the number. Please try again.',
      );
    }
  }
}

/**
 * Runs a contact action for a logged-in user. Each phase registers its action here:
 * whatsapp (1) · call (2) · like/save (3) · book/inquiry (5) · chat (6).
 */
export function executeContactAction(req: ContactRequest) {
  switch (req.action) {
    case 'whatsapp':
      useWhatsappPicker.getState().openPicker(req.context ?? {});
      return;
    case 'call':
      void revealNumber(req);
      return;
    // Gated like/save: after login they always *apply* (never toggle off), so one click is enough.
    case 'like':
      if (req.context?.shortId && !useShortEngagement.getState().liked[req.context.shortId]) {
        void setShortLiked(
          req.context.shortId,
          true,
          useShortEngagement.getState().likeCount[req.context.shortId] ?? 0,
        );
      }
      return;
    case 'save':
      if (req.context?.shortId && !useShortEngagement.getState().saved[req.context.shortId]) {
        void setShortSaved(req.context.shortId, true);
      }
      return;
    default:
      toast.info('This feature is coming soon.');
  }
}
