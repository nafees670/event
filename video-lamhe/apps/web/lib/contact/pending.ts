import { CONTACT_ACTIONS } from '@video-lamhe/shared';
import type { PendingAction } from './types';

const KEY = 'vl-pending-action';
/** A pending action older than this is dropped (user wandered off). */
export const PENDING_TTL_MS = 30 * 60_000;

export function savePendingAction(action: PendingAction) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(action));
  } catch {
    // storage unavailable (private mode) — the action just won't auto-resume
  }
}

export function loadPendingAction(now = Date.now()): PendingAction | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PendingAction;
    const valid =
      (CONTACT_ACTIONS as readonly string[]).includes(p.action) &&
      typeof p.returnTo === 'string' &&
      typeof p.createdAt === 'number' &&
      now - p.createdAt < PENDING_TTL_MS;
    if (!valid) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return p;
  } catch {
    return null;
  }
}

export function clearPendingAction() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
