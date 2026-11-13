import type { Metadata } from 'next';
import Link from 'next/link';
import type { DroneDetail, PublicCity, PublicShort, ShortFeedMeta } from '@video-lamhe/shared';
import { ShortThumbGrid } from '@/components/shorts/short-thumb';
import { DroneMedia } from '@/components/catalog/drone-model-card';
import { EmptyState } from '@/components/catalog/empty-state';
import { FilterBar } from '@/components/catalog/filter-bar';
import { OperatorCard } from '@/components/catalog/operator-card';
import { WhatsappButton } from '@/components/contact/whatsapp-button';
import { Badge } from '@/components/ui';
import { qs, serverApi, serverApiSafe } from '@/lib/api/server';
import { pickSlug } from '@/lib/catalog-options';
import { formatPKR, param, plural } from '@/lib/format';

type Params = Promise<{ slug: string }>;
type SP = Promise<Record<string, string | string[] | undefined>>;

const SPEC_LABELS = {
  camera: 'Camera',
  video: 'Video',
  flightTime: 'Flight time',
  range: 'Range',
} as const;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  // allowMissing: notFound() only in the page, for a real 404 (see operators/[slug]).
  const { data } = await serverApi<DroneDetail | null>(`/drones/${encodeURIComponent(slug)}`, {
    allowMissing: true,
  });
  if (!data) return { title: 'Drone not found', robots: { index: false } };
  return {
    title: `${data.model.name} for weddings`,
    description:
      data.model.bestFor ??
      `${data.model.name} wedding drone videography — ${plural(data.model.operatorCount, 'operator')} across Pakistan.`,
    alternates: { canonical: `/drones/${slug}` },
  };
}

export default async function DronePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SP;
}) {
  const { slug } = await params;
  const city = pickSlug(param((await searchParams).city));
  const [{ data }, { data: cities }] = await Promise.all([
    serverApi<DroneDetail>(`/drones/${encodeURIComponent(slug)}${qs({ city })}`),
    serverApi<PublicCity[]>('/cities'),
  ]);
  const samples =
    (
      await serverApiSafe<PublicShort[], ShortFeedMeta>(
        `/shorts?drone=${encodeURIComponent(slug)}&limit=8`,
      )
    )?.data ?? [];
  const { model, offers } = data;
  const cityName = cities.find((c) => c.slug === city)?.name;
  const specs = Object.entries(SPEC_LABELS).filter(
    ([k]) => model.specs[k as keyof typeof SPEC_LABELS],
  );

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-10 px-4 pb-24 pt-10 sm:px-6">
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href="/drones" className="hover:underline">
          Drones
        </Link>{' '}
        / <span className="text-ink">{model.name}</span>
      </nav>

      <section className="grid gap-8 lg:grid-cols-2">
        <DroneMedia model={model} className="aspect-[4/3]" />
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            {model.tag && <Badge variant="gold">{model.tag}</Badge>}
            <Badge variant="outline">
              {plural(model.operatorCount, 'operator')}
              {cityName ? ` in ${cityName}` : ''}
            </Badge>
          </div>
          <h1 className="text-5xl leading-[1.05] sm:text-6xl">{model.name}</h1>
          {model.bestFor && <p className="text-lg text-muted">{model.bestFor}</p>}
          <p>
            {model.priceFrom !== null ? (
              <>
                <span className="text-muted">From </span>
                <span className="text-2xl font-medium">{formatPKR(model.priceFrom)}</span>
                <span className="text-muted"> per event</span>
              </>
            ) : (
              <span className="text-muted">Price on request</span>
            )}
          </p>
          {specs.length > 0 && (
            <dl className="grid grid-cols-2 gap-3">
              {specs.map(([k, label]) => (
                <div key={k} className="rounded-media border border-line bg-surface p-4">
                  <dt className="text-xs uppercase tracking-wider text-muted">{label}</dt>
                  <dd className="mt-1 text-sm">{model.specs[k as keyof typeof SPEC_LABELS]}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </section>

      {samples.length > 0 && (
        <section aria-labelledby="samples" className="flex flex-col gap-4">
          <h2 id="samples" className="text-3xl">
            Shot on this <em className="accent">drone</em>
          </h2>
          <ShortThumbGrid shorts={samples} />
        </section>
      )}

      <section className="flex flex-col gap-6" aria-labelledby="offers">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <h2 id="offers" className="text-4xl">
            Operators with this <em className="accent">drone</em>
          </h2>
          <FilterBar
            filters={[
              {
                name: 'city',
                label: 'City',
                allLabel: 'All cities',
                options: cities.map((c) => ({ value: c.slug, label: c.name })),
              },
            ]}
          />
        </div>
        {offers.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {offers.map((o) => (
              <OperatorCard key={o.id} operator={o} offer={o.offer} cityName={cityName} />
            ))}
          </div>
        ) : (
          <EmptyState title={`No ${model.name} operators${cityName ? ` in ${cityName}` : ''} yet`}>
            <p className="mb-4">Tell us your date and city — our team will find someone for you.</p>
            <WhatsappButton context={{ droneName: model.name, cityName }}>
              Ask on WhatsApp
            </WhatsappButton>
          </EmptyState>
        )}
      </section>
    </main>
  );
}
