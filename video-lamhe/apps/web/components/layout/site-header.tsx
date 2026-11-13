'use client';

import { UserRound } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button, Skeleton } from '@/components/ui';
import { DASHBOARD_HREF } from '@/lib/auth/dashboard';
import { useAuthStore } from '@/stores/auth';
import { Logo } from './logo';
import { SiteNav } from './site-nav';
import { SyncedThemeToggle } from './synced-theme-toggle';

/** Floating pill navbar. More links (Shorts) arrive with their pages. */
export function SiteHeader() {
  const { status, user } = useAuthStore();
  const pathname = usePathname();

  return (
    <header className="sticky top-3 z-40 mx-3 mt-3 flex items-center justify-between gap-2 rounded-full border border-line bg-surface/90 py-1.5 pl-5 pr-1.5 shadow-soft backdrop-blur dark:shadow-none sm:mx-auto sm:max-w-5xl">
      <div className="flex items-center gap-4">
        <Logo />
      </div>
      <div className="flex items-center gap-1">
        <SiteNav />
        <SyncedThemeToggle />
        {status === 'loading' ? (
          <Skeleton className="h-11 w-24 rounded-full" />
        ) : status === 'authenticated' && user ? (
          <Button asChild size="sm" variant="outline">
            <Link href={DASHBOARD_HREF[user.role]}>
              <UserRound aria-hidden="true" />
              <span className="max-w-28 truncate">{user.name.split(' ')[0]}</span>
            </Link>
          </Button>
        ) : (
          <Button asChild size="sm">
            <Link href={`/login?returnTo=${encodeURIComponent(pathname)}`}>Log in</Link>
          </Button>
        )}
      </div>
    </header>
  );
}
