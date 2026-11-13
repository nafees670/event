import type { Metadata } from 'next';
import {
  EVENT_TYPE_VALUES,
  type PublicCity,
  type PublicShort,
  type ShortFeedMeta,
} from '@video-lamhe/shared';
import { ShortsFeed } from '@/components/shorts/shorts-feed';
import { qs, serverApi, serverApiSafe } from '@/lib/api/server';
import { pick, pickSlug } from '@/lib/catalog-options';
import { param } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Wedding drone shorts',
  description:
    'Watch wedding drone shorts from verified operators across Pakistan — mehndi, barat, walima and more.',
  alternates: { canonical: '/shorts' },
};

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function ShortsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const params = {
    city: pickSlug(param(sp.city)),
    event: pick(param(sp.event), EVENT_TYPE_VALUES),
  };
  const startId = param(sp.start);
  const validStart = startId && /^[a-f\d]{24}$/i.test(startId) ? startId : undefined;

  const [initial, { data: cities }, start] = await Promise.all([
    serverApi<PublicShort[], ShortFeedMeta>(`/shorts${qs({ ...params, limit: 8 })}`, {
      revalidate: 30,
    }),
    serverApi<PublicCity[]>('/cities'),
    validStart
      ? serverApiSafe<PublicShort | null>(`/shorts/${validStart}`, { revalidate: 30 })
      : null,
  ]);

  return (
    <ShortsFeed
      // new filters → fresh feed state
      key={`${params.city ?? ''}|${params.event ?? ''}|${validStart ?? ''}`}
      initial={initial}
      params={params}
      start={start?.data ?? null}
      cities={cities.map((c) => ({ slug: c.slug, name: c.name }))}
    />
  );
}
