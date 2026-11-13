'use client';

import { usePathname, useRouter } from 'next/navigation';
import { EVENT_TYPES } from '@video-lamhe/shared';
import { eventShort } from '@/lib/events';
import { cn } from '@/lib/utils';

/** Event chips + city select floating over the feed. Filters live in the URL. */
export function ShortsFilters({
  params,
  cities,
}: {
  params: { city?: string; event?: string };
  cities: { slug: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const go = (next: { city?: string; event?: string }) => {
    const p = new URLSearchParams(
      Object.entries(next).filter(([, v]) => v) as [string, string][],
    ).toString();
    router.replace(`${pathname}${p ? `?${p}` : ''}`, { scroll: false });
  };
  const chip = (selected: boolean) =>
    cn(
      'inline-flex h-9 shrink-0 items-center rounded-full px-3.5 text-sm font-medium backdrop-blur-md transition-colors',
      selected ? 'bg-white text-black' : 'bg-black/40 text-white hover:bg-black/60',
    );

  return (
    <div className="absolute inset-x-0 top-[4.75rem] z-10 mx-auto flex max-w-[calc(100dvh*9/16)] flex-col gap-2 px-3">
      <div
        className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]"
        role="group"
        aria-label="Filter by event"
      >
        <button
          type="button"
          className={chip(!params.event)}
          aria-pressed={!params.event}
          onClick={() => go({ city: params.city })}
        >
          All
        </button>
        {EVENT_TYPES.map((e) => (
          <button
            key={e.value}
            type="button"
            className={chip(params.event === e.value)}
            aria-pressed={params.event === e.value}
            onClick={() =>
              go({ city: params.city, event: params.event === e.value ? undefined : e.value })
            }
          >
            {eventShort(e.value)}
          </button>
        ))}
      </div>
      <label className="sr-only" htmlFor="shorts-city">
        City
      </label>
      <select
        id="shorts-city"
        value={params.city ?? ''}
        onChange={(e) => go({ event: params.event, city: e.target.value || undefined })}
        className="h-9 w-fit cursor-pointer rounded-full border-0 bg-black/40 pl-3.5 pr-8 text-sm text-white backdrop-blur-md focus-visible:ring-2 focus-visible:ring-white [&>option]:text-black"
      >
        <option value="">All cities</option>
        {cities.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}
