import type { Metadata } from 'next';
import Link from 'next/link';
import type {
  PageMeta,
  PublicCity,
  PublicOperatorCard,
  PublicShort,
  ShortFeedMeta,
} from '@video-lamhe/shared';
import { ShortThumbGrid } from '@/components/shorts/short-thumb';
import { EmptyState } from '@/components/catalog/empty-state';
import { OperatorCard } from '@/components/catalog/operator-card';
import { PageHeader } from '@/components/catalog/page-header';
import { WhatsappButton } from '@/components/contact/whatsapp-button';
import { Button } from '@/components/ui';
import { serverApi, serverApiSafe } from '@/lib/api/server';
import { plural } from '@/lib/format';

type Params = Promise<{ slug: string }>;

const getCity = (slug: string) =>
  serverApi<PublicCity>(`/cities/${encodeURIComponent(slug)}`, { revalidate: 60 });

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  // allowMissing: notFound() only in the page, for a real 404 (see operators/[slug]).
  const { data: city } = await serverApi<PublicCity | null>(`/cities/${encodeURIComponent(slug)}`, {
    revalidate: 60,
    allowMissing: true,
  });
  if (!city) return { title: 'City not found', robots: { index: false } };
  return {
    title: `Wedding drone videography in ${city.name}`,
    description: `Book verified wedding drone operators in ${city.name}, ${city.province}. Compare drones and prices.`,
    alternates: { canonical: `/cities/${slug}` },
  };
}

export default async function CityPage({ params }: { params: Params }) {
  const { slug } = await params;
  const [{ data: city }, { data: operators, meta }] = await Promise.all([
    getCity(slug),
    serverApi<PublicOperatorCard[], PageMeta>(
      `/operators?city=${encodeURIComponent(slug)}&limit=24`,
    ),
  ]);
  const shorts =
    (
      await serverApiSafe<PublicShort[], ShortFeedMeta>(
        `/shorts?city=${encodeURIComponent(slug)}&limit=8`,
      )
    )?.data ?? [];

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 pb-24 pt-10 sm:px-6">
      <PageHeader
        eyebrow={city.province}
        title={
          <>
            Drone videography in <em className="accent">{city.name}</em>
          </>
        }
      >
        {plural(city.operatorCount, 'operator')} based in or travelling to {city.name} for mehndi,
        barat, walima and pre-wedding shoots.
      </PageHeader>

      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <Link href={`/drones?city=${city.slug}`}>Drones available in {city.name}</Link>
        </Button>
      </div>

      {operators.length ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {operators.map((o) => (
            <OperatorCard key={o.id} operator={o} cityName={city.name} />
          ))}
        </div>
      ) : (
        <EmptyState title={`No operators listed in ${city.name} yet`}>
          <p className="mb-4">Our team can still arrange a drone shoot in {city.name}.</p>
          <WhatsappButton context={{ cityName: city.name }}>Ask on WhatsApp</WhatsappButton>
        </EmptyState>
      )}

      {shorts.length > 0 && (
        <section aria-labelledby="city-shorts" className="flex flex-col gap-4">
          <h2 id="city-shorts" className="text-3xl">
            Shorts from {city.name}
          </h2>
          <ShortThumbGrid shorts={shorts} />
        </section>
      )}

      {meta.total > operators.length && (
        <Button asChild variant="outline" className="self-center">
          <Link href={`/operators?city=${city.slug}`}>
            See all {plural(meta.total, 'operator')}
          </Link>
        </Button>
      )}
    </main>
  );
}
