'use client';

import { useTheme } from 'next-themes';
import { useEffect, useRef } from 'react';
import { refreshSession } from '@/lib/api/client';
import { useAuthStore } from '@/stores/auth';

/** Restores the session from the refresh cookie on first load and applies the user's saved theme. */
export function AuthBootstrap() {
  const started = useRef(false);
  const userId = useAuthStore((s) => s.user?.id);
  const themePreference = useAuthStore((s) => s.user?.themePreference);
  const { setTheme } = useTheme();

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void refreshSession();
  }, []);

  // When a user logs in (or the session is restored), their saved preference wins.
  useEffect(() => {
    if (userId && themePreference) setTheme(themePreference);
    // Only on user change — later toggles are saved to the user by SyncedThemeToggle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return null;
}
