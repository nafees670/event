'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { executeContactAction } from '@/lib/contact/execute';
import { clearPendingAction, loadPendingAction } from '@/lib/contact/pending';
import { pathOnly } from '@/lib/contact/return-to';
import { useAuthStore } from '@/stores/auth';

/**
 * Mounted once in the root layout. After login redirects back to `returnTo`,
 * this picks up the saved action and runs it automatically (Section 2.1, step 3).
 */
export function PendingActionRunner() {
  const status = useAuthStore((s) => s.status);
  const pathname = usePathname();

  useEffect(() => {
    if (status !== 'authenticated') return;
    const pending = loadPendingAction();
    if (!pending || pathOnly(pending.returnTo) !== pathname) return;
    clearPendingAction();
    executeContactAction(pending);
  }, [status, pathname]);

  return null;
}
