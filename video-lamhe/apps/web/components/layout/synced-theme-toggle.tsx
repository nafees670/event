'use client';

import { ThemeToggle } from '@/components/ui';
import { updateMe } from '@/lib/api/auth';
import { useAuthStore } from '@/stores/auth';

/** ThemeToggle that also saves the choice on the logged-in user (User.themePreference). */
export function SyncedThemeToggle({ className }: { className?: string }) {
  return (
    <ThemeToggle
      className={className}
      onChange={(themePreference) => {
        if (useAuthStore.getState().status === 'authenticated') {
          updateMe({ themePreference }).catch(() => {
            // Non-critical: theme still applied locally.
          });
        }
      }}
    />
  );
}
