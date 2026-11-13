import { create } from 'zustand';
import type { AuthResult, PublicUser } from '@video-lamhe/shared';

export type AuthStatus = 'loading' | 'authenticated' | 'guest';

interface AuthState {
  status: AuthStatus;
  user: PublicUser | null;
  /** Kept in memory only (never localStorage) — restored on load via the refresh cookie. */
  accessToken: string | null;
  setSession: (result: AuthResult) => void;
  setUser: (user: PublicUser) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  user: null,
  accessToken: null,
  setSession: ({ user, accessToken }) => set({ status: 'authenticated', user, accessToken }),
  setUser: (user) => set({ user }),
  clear: () => set({ status: 'guest', user: null, accessToken: null }),
}));

/** Resolves once the initial session check has finished. */
export function waitForAuth(): Promise<AuthStatus> {
  const { status } = useAuthStore.getState();
  if (status !== 'loading') return Promise.resolve(status);
  return new Promise((resolve) => {
    const unsub = useAuthStore.subscribe((s) => {
      if (s.status !== 'loading') {
        unsub();
        resolve(s.status);
      }
    });
  });
}
