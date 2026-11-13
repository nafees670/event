'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Menu } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export const NAV_LINKS = [
  { href: '/shorts', label: 'Shorts' },
  { href: '/drones', label: 'Drones' },
  { href: '/operators', label: 'Operators' },
] as const;

export function SiteNav() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  return (
    <>
      <nav aria-label="Main" className="hidden items-center gap-1 sm:flex">
        {NAV_LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={isActive(l.href) ? 'page' : undefined}
            className={cn(
              'inline-flex h-11 items-center rounded-full px-4 text-sm transition-colors hover:bg-sand',
              isActive(l.href) ? 'font-medium text-ink' : 'text-muted',
            )}
          >
            {l.label}
          </Link>
        ))}
      </nav>
      {/* Mobile: compact menu until the bottom navigation arrives in Phase 4. */}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          aria-label="Open menu"
          className="inline-flex size-11 items-center justify-center rounded-full text-ink hover:bg-sand sm:hidden"
        >
          <Menu className="size-5" aria-hidden="true" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={8}
            className="z-50 min-w-44 rounded-media border border-line bg-surface p-1.5 text-ink shadow-lift outline-none focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=open]:animate-fade-in"
          >
            {NAV_LINKS.map((l) => (
              <DropdownMenu.Item key={l.href} asChild>
                <Link
                  href={l.href}
                  className="flex h-11 items-center rounded-input px-3 text-sm outline-none data-[highlighted]:bg-sand"
                >
                  {l.label}
                </Link>
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </>
  );
}
