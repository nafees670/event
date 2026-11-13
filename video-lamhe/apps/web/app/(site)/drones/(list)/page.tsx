import type { Metadata } from 'next';
import { EVENT_TYPE_VALUES, type PublicCity, type PublicDroneModel } from '@video-lamhe/shared';
import { DroneModelCard } from '@/components/catalog/drone-model-card';
import { EmptyState } from '@/components/catalog/empty-state';
import { FilterBar } from '@/components/catalog/filter-bar';
import { PageHeader } from '@/components/catalog/page-header';
import { qs, serverApi } from '@/lib/api/server';
import {
  BUDGET_OPTIONS,
  DRONE_SORT_OPTIONS,
  EVENT_OPTIONS,
  pick,
  pickBudget,
  pickDroneSort,
  pickSlug,
} from '@/lib/catalog-options';
import { param } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Compare wedding drones',
  description:
    'Compare DJI drones for wedding videography — specs, prices and operators in your city.',
  alternates: { canonical: '/drones' },
};

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function DronesPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const city = pickSlug(param(sp.city));
  const budget = pickBudget(param(sp.budget));
  const event = pick(param(sp.event), EVENT_TYPE_VALUES);
  const sort = pickDroneSort(param(sp.sort));

  const [{ data: drones }, { data: cities }] = await Promise.all([
    serverApi<PublicDroneModel[]>(`/drones${qs({ city, event, maxPrice: budget, sort })}`),
    serverApi<PublicCity[]>('/cities'),
  ]);
  const cityName = cities.find((c) => c.slug === city)?.name;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 pb-24 pt-10 sm:px-6">
      <PageHeader
        eyebrow="Drones"
        title={
          <>
            Compare <em className="accent">drones</em>
          </>
        }
      >
        Every drone our operators fly, with the lowest price per event
        {cityName ? ` in ${cityName}` : ''}.
      </PageHeader>

      <FilterBar
        filters={[
          {
            name: 'city',
            label: 'City',
            allLabel: 'All cities',
            options: cities.map((c) => ({ value: c.slug, label: c.name })),
          },
          { name: 'event', label: 'Event', allLabel: 'Any event', options: EVENT_OPTIONS },
          { name: 'budget', label: 'Budget', allLabel: 'Any budget', options: BUDGET_OPTIONS },
          { name: 'sort', label: 'Sort by', options: DRONE_SORT_OPTIONS },
        ]}
      />

      {drones.length ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {drones.map((d) => (
            <DroneModelCard key={d.id} model={d} citySlug={city} />
          ))}
        </div>
      ) : (
        <EmptyState title="No drones match">Try another city or a higher budget.</EmptyState>
      )}
    </main>
  );
}
