import type { ReactNode } from 'react';
import { Logo } from '@/components/layout/logo';
import { SyncedThemeToggle } from '@/components/layout/synced-theme-toggle';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-5 py-4">
        <Logo />
        <SyncedThemeToggle />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-4 sm:items-center sm:pt-0">
        <div className="w-full max-w-md has-[form_fieldset]:max-w-2xl">{children}</div>
      </main>
    </div>
  );
}
