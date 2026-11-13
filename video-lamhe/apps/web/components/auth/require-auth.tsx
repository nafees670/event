'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import type { Role } from '@video-lamhe/shared';
import { Button, Skeleton } from '@/components/ui';
import { useAuthStore } from '@/stores/auth';

interface RequireAuthProps {
  /** Allowed roles; omit for any logged-in user. */
  roles?: Role[];
  children: ReactNode;
}

/**
 * Client-side guard for dashboards. UX only — the API enforces auth/roles on every request.
 */
export function RequireAuth({ roles, children }: RequireAuthProps) {
  const { status, user } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'guest') router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
  }, [status, router, pathname]);

  if (status !== 'authenticated' || !user) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-16" aria-busy="true">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-40 w-full rounded-card" />
      </div>
    );
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
        <h1 className="text-4xl">No access</h1>
        <p className="text-muted">Your account doesn’t have permission to view this page.</p>
        <Button asChild variant="outline">
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
