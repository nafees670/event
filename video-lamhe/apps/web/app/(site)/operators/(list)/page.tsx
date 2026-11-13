import type { Metadata } from 'next';
import {
  EVENT_TYPE_VALUES,
  type PageMeta,
  type PublicCity,
  type PublicDroneModel,
  type PublicOperatorCard,
} from '@video-lamhe/shared';
import { EmptyState } from '@/components/catalog/empty-state';
import { FilterBar } from '@/components/catalog/filter-bar';
import { OperatorCard } from '@/components/catalog/operator-card';
import { PageHeader } from '@/components/catalog/page-header';
import { Pagination } from '@/components/catalog/pagination';
import { WhatsappButton } from '@/components/contact/whatsapp-button';
import { qs, serverApi } from '@/lib/api/server';
import {
  EVENT_OPTIONS,
  OPERATOR_SORT_OPTIONS,
  pick,
  pickOperatorSort,
  pickPage,
  pickQuery,
  pickSlug,
} from '@/lib/catalog-options';
import { param, plural } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Drone operators',
  description:
    'Verified wedding drone operators across Pakistan — compare drones, prices and cities.',
  alternates: { canonical: '/operators' },
};

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function OperatorsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const filters = {
    city: pickSlug(param(sp.city)),
    drone: pickSlug(param(sp.drone)),
    q: pickQuery(param(sp.q)),
    event: pick(param(sp.event), EVENT_TYPE_VALUES),
    sort: pickOperatorSort(param(sp.sort)),
  };
  const page = pickPage(param(sp.page));

  const [{ data: operators, meta }, { data: cities }, { data: drones }] = await Promise.all([
    serverApi<PublicOperatorCard[], PageMeta>(`/operators${qs({ ...filters, page })}`),
    serverApi<PublicCity[]>('/cities'),
    serverApi<PublicDroneModel[]>('/drones'),
  ]);
  const cityName = cities.find((c) => c.slug === filters.city)?.name;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 pb-24 pt-10 sm:px-6">
      <PageHeader
        eyebrow="Operators"
        title={
          <>
            Find your <em className="accent">operator</em>
          </>
        }
      >
        Browse freely — log in only when you want to get in touch.
      </PageHeader>

      <FilterBar
        searchPlaceholder="Search by name or speciality"
        filters={[
          {
            name: 'city',
            label: 'City',
            allLabel: 'All cities',
            options: cities.map((c) => ({ value: c.slug, label: c.name })),
          },
          {
            name: 'drone',
            label: 'Drone',
            allLabel: 'Any drone',
            options: drones.map((d) => ({ value: d.slug, label: d.name })),
          },
          { name: 'event', label: 'Event', allLabel: 'Any event', options: EVENT_OPTIONS },
          { name: 'sort', label: 'Sort by', options: OPERATOR_SORT_OPTIONS },
        ]}
      />

      <p className="text-sm text-muted" aria-live="polite">
        {plural(meta.total, 'operator')}
        {cityName ? ` in ${cityName}` : ''}
      </p>

      {operators.length ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {operators.map((o) => (
            <OperatorCard key={o.id} operator={o} cityName={cityName} />
          ))}
        </div>
      ) : (
        <EmptyState title="No operators found">
          <p className="mb-4">
            Don’t see your city? Our team covers all of Pakistan — send us your details.
          </p>
          <WhatsappButton context={{ cityName }}>Contact us on WhatsApp</WhatsappButton>
        </EmptyState>
      )}

      <Pagination meta={meta} basePath="/operators" params={{ ...filters, sort: filters.sort }} />
    </main>
  );
}
