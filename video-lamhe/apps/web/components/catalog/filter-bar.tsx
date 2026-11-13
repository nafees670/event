'use client';

import { Search, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button, Select, type SelectOption } from '@/components/ui';
import { cn } from '@/lib/utils';

export interface FilterDef {
  name: string;
  label: string;
  options: readonly SelectOption[];
  /** Label of the "no filter" option; omit for filters that always have a value (sort). */
  allLabel?: string;
}

/** Keeps the URL's value selectable even if the (cached) option list doesn't have it yet. */
function withCurrent(
  options: readonly SelectOption[],
  current: string | null,
): readonly SelectOption[] {
  if (!current || options.some((o) => o.value === current)) return options;
  const label = current.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return [...options, { value: current, label }];
}

/** Writes filters to the URL (shareable, SEO-friendly); the server page re-renders. */
export function FilterBar({
  filters,
  searchPlaceholder,
  className,
}: {
  filters: FilterDef[];
  searchPlaceholder?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get('q') ?? '');

  const update = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete('page'); // new filter → back to page 1
    const s = next.toString();
    startTransition(() => router.push(`${pathname}${s ? `?${s}` : ''}`, { scroll: false }));
  };

  const active = filters.some((f) => f.allLabel && params.get(f.name)) || Boolean(params.get('q'));

  return (
    <div className={cn('flex flex-col gap-3', className)} aria-busy={pending}>
      {searchPlaceholder && (
        <form
          role="search"
          className="relative"
          onSubmit={(e) => {
            e.preventDefault();
            update({ q: q.trim() || undefined });
          }}
        >
          <label htmlFor="filter-q" className="sr-only">
            Search
          </label>
          <Search
            className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            id="filter-q"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-12 w-full rounded-full border border-line bg-surface pl-11 pr-28 text-[15px] text-ink placeholder:text-muted/70 focus-visible:border-gold focus-visible:shadow-[0_0_0_3px_rgb(var(--gold)/0.25)] focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <Button
            type="submit"
            size="sm"
            variant="gold"
            className="absolute right-1 top-1/2 h-10 -translate-y-1/2"
          >
            Search
          </Button>
        </form>
      )}
      <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
        {filters.map((f) => (
          <Select
            key={f.name}
            label={f.label}
            containerClassName="sm:w-48"
            placeholder={f.allLabel}
            options={withCurrent(f.options, params.get(f.name))}
            value={params.get(f.name) ?? (f.allLabel ? '' : f.options[0]?.value)}
            onChange={(e) => update({ [f.name]: e.target.value || undefined })}
          />
        ))}
        {active && (
          <Button
            variant="ghost"
            size="sm"
            className="col-span-2 justify-self-start sm:mb-0.5"
            onClick={() => {
              setQ('');
              update(
                Object.fromEntries([...filters.map((f) => [f.name, undefined]), ['q', undefined]]),
              );
            }}
          >
            <X aria-hidden="true" /> Clear filters
          </Button>
        )}
      </div>
    </div>
  );
}
