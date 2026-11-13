'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui';
import { logout } from '@/lib/api/auth';
import { Logo } from './logo';
import { SyncedThemeToggle } from './synced-theme-toggle';

export function DashboardHeader({ label }: { label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <header className="flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-2 sm:px-6">
      <div className="flex items-baseline gap-3">
        <Logo />
        <span className="hidden text-sm text-muted sm:inline">{label}</span>
      </div>
      <div className="flex items-center gap-1">
        <SyncedThemeToggle />
        <Button
          variant="ghost"
          size="sm"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            await logout().catch(() => undefined);
            router.replace('/');
          }}
        >
          {!busy && <LogOut aria-hidden="true" />}
          Log out
        </Button>
      </div>
    </header>
  );
}
