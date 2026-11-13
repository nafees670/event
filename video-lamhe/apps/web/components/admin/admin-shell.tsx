'use client';

import { Building2, Film, LayoutDashboard, Plane, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { RequireAuth } from '@/components/auth/require-auth';
import { DashboardHeader } from '@/components/layout/dashboard-header';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/admin', label: 'Dashboard', Icon: LayoutDashboard, exact: true },
  { href: '/admin/shorts', label: 'Shorts', Icon: Film },
  { href: '/admin/operators', label: 'Operators', Icon: Users },
  { href: '/admin/cities', label: 'Cities', Icon: Building2 },
  { href: '/admin/drones', label: 'Drones', Icon: Plane },
];
/** Shown greyed out so the admin knows what's coming. */
const SOON = ['Inquiries', 'Reviews', 'Settings'];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const active = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <RequireAuth roles={['admin']}>
      <DashboardHeader label="Admin panel" />
      <div className="mx-auto flex max-w-7xl flex-col lg:flex-row">
        <nav
          aria-label="Admin"
          className="flex gap-1 overflow-x-auto border-b border-line px-3 py-2 [scrollbar-width:none] lg:sticky lg:top-0 lg:h-[calc(100dvh-61px)] lg:w-60 lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r lg:px-3 lg:py-6"
        >
          {NAV.map(({ href, label, Icon, exact }) => (
            <Link
              key={href}
              href={href}
              aria-current={active(href, exact) ? 'page' : undefined}
              className={cn(
                'inline-flex h-11 shrink-0 items-center gap-3 rounded-full px-4 text-sm transition-colors lg:rounded-input',
                active(href, exact)
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted hover:bg-sand hover:text-ink',
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </Link>
          ))}
          <div className="hidden lg:mt-6 lg:flex lg:flex-col lg:gap-1">
            {SOON.map((l) => (
              <span
                key={l}
                className="flex h-11 items-center justify-between rounded-input px-4 text-sm text-muted/60"
              >
                {l} <span className="text-xs">Soon</span>
              </span>
            ))}
          </div>
        </nav>
        <main className="min-w-0 flex-1 px-4 py-8 sm:px-8">{children}</main>
      </div>
    </RequireAuth>
  );
}
