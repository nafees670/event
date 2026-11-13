'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { waitForAuth } from '@/stores/auth';
import { executeContactAction } from './execute';
import { savePendingAction } from './pending';
import type { ContactRequest } from './types';

export function buildLoginHref(req: ContactRequest, returnTo: string): string {
  const params = new URLSearchParams({ returnTo, action: req.action });
  if (req.context?.operatorSlug) params.set('target', req.context.operatorSlug);
  return `/login?${params.toString()}`;
}

/**
 * "Browse free, login to contact" (Section 2.1).
 * Logged in → run the action now. Guest → remember it, go to /login, and
 * PendingActionRunner resumes it after login so the user never clicks twice.
 */
export function useContactAction() {
  const router = useRouter();

  return useCallback(
    async (req: ContactRequest) => {
      const status = await waitForAuth();
      if (status === 'authenticated') {
        executeContactAction(req);
        return;
      }
      // Read at click time (avoids useSearchParams → no Suspense boundary needed on every page).
      const returnTo = `${window.location.pathname}${window.location.search}`;
      savePendingAction({ ...req, returnTo, createdAt: Date.now() });
      router.push(buildLoginHref(req, returnTo));
    },
    [router],
  );
}
