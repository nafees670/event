'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { Film } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PublicShort, ShortEngagement, ShortFeedMeta } from '@video-lamhe/shared';
import { Button } from '@/components/ui';
import { api, apiWithMeta } from '@/lib/api/client';
import { useAuthStore } from '@/stores/auth';
import { useShortEngagement } from '@/stores/short-engagement';
import { ShortPlayer } from './short-player';
import { ShortsFilters } from './shorts-filters';

interface Props {
  initial: { data: PublicShort[]; meta: ShortFeedMeta };
  params: { city?: string; event?: string };
  /** Opened from a share link / thumbnail: shown first. */
  start?: PublicShort | null;
  cities: { slug: string; name: string }[];
}

const toQs = (p: Record<string, string | undefined>) => {
  const s = new URLSearchParams(
    Object.entries(p).filter(([, v]) => v) as [string, string][],
  ).toString();
  return s ? `&${s}` : '';
};

/** Vertical full-screen feed with cursor-based infinite scroll (Section 5.2). */
export function ShortsFeed({ initial, params, start, cities }: Props) {
  const feed = useInfiniteQuery({
    queryKey: ['shorts', params],
    queryFn: ({ pageParam }) =>
      apiWithMeta<PublicShort[], ShortFeedMeta>(
        `/shorts?limit=8${toQs(params)}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.meta.nextCursor,
    initialData: { pages: [initial], pageParams: [null] },
    staleTime: 60_000,
  });

  const items = useMemo(() => {
    const all = feed.data.pages.flatMap((p) => p.data);
    return start ? [start, ...all.filter((s) => s.id !== start.id)] : all;
  }, [feed.data, start]);

  const [active, setActive] = useState(0);
  const onVisible = useCallback((i: number) => setActive(i), []);

  // Prefetch when 3 from the end.
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = feed;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && active >= items.length - 3) void fetchNextPage();
  }, [active, items.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Logged in → load my likes/saves for shorts not checked yet.
  const authed = useAuthStore((s) => s.status === 'authenticated');
  const checked = useRef(new Set<string>());
  useEffect(() => {
    if (!authed) {
      checked.current.clear();
      return;
    }
    const ids = items
      .map((s) => s.id)
      .filter((id) => !checked.current.has(id))
      .slice(0, 50);
    if (!ids.length) return;
    ids.forEach((id) => checked.current.add(id));
    api<ShortEngagement>(`/shorts/engagement?ids=${ids.join(',')}`)
      .then((eng) => useShortEngagement.getState().merge(eng, ids))
      .catch(() => ids.forEach((id) => checked.current.delete(id)));
  }, [authed, items]);

  return (
    <div className="fixed inset-0 z-30 bg-black">
      <ShortsFilters params={params} cities={cities} />
      {items.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center text-white">
          <Film className="size-10 text-white/60" aria-hidden="true" />
          <h1 className="font-serif text-4xl">No shorts here yet</h1>
          <p className="max-w-sm text-white/70">
            Try another event or city — new wedding drone shorts are added every week.
          </p>
          <Button
            asChild
            variant="outline"
            className="border-white/30 bg-transparent text-white hover:bg-white/10"
          >
            <Link href="/shorts">See all shorts</Link>
          </Button>
        </div>
      ) : (
        <div className="h-full snap-y snap-mandatory overflow-y-scroll overscroll-contain [scrollbar-width:none]">
          <h1 className="sr-only">Wedding drone shorts</h1>
          {items.map((s, i) => (
            <ShortPlayer
              key={s.id}
              short={s}
              index={i}
              active={i === active}
              near={Math.abs(i - active) <= 1}
              onVisible={onVisible}
            />
          ))}
          {isFetchingNextPage && (
            <p className="py-6 text-center text-sm text-white/60" role="status">
              Loading more…
            </p>
          )}
        </div>
      )}
    </div>
  );
}
