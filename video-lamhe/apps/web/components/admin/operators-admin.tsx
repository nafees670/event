'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { BadgeCheck, ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { OPERATOR_STATUSES, type OperatorStatus } from '@video-lamhe/shared';
import { Button, FormAlert, Select, Skeleton, Tabs, TabsList, TabsTrigger } from '@/components/ui';
import { adminCities, adminOperators, queryKeys } from '@/lib/api/catalog-client';
import { formatPKR } from '@/lib/format';
import { AdminPageHeader, DataTable } from './admin-page';
import { OperatorStatusActions } from './operator-status-actions';
import { OperatorStatusBadge } from './status-badge';

export function OperatorsAdmin({ initialStatus }: { initialStatus?: OperatorStatus }) {
  const [city, setCity] = useState('all');
  const [status, setStatus] = useState<OperatorStatus | ''>(initialStatus ?? '');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  const cities = useQuery({ queryKey: queryKeys.adminCities, queryFn: adminCities.list });
  const query = {
    city: city === 'all' ? undefined : city,
    status: status || undefined,
    q: q || undefined,
    page,
    limit: 20,
  };
  const ops = useQuery({
    queryKey: queryKeys.adminOperators(query),
    queryFn: () => adminOperators.list(query),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <AdminPageHeader
        title="Operators"
        description="Approve sign-ups, add operators and manage their listings."
        actions={
          <Button asChild>
            <Link href="/admin/operators/new">
              <Plus aria-hidden="true" /> Add operator
            </Link>
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-4">
        <Tabs
          value={city}
          onValueChange={(v) => {
            setCity(v);
            setPage(1);
          }}
        >
          <TabsList aria-label="Filter by city">
            <TabsTrigger value="all">All cities</TabsTrigger>
            {cities.data
              ?.filter((c) => c.operatorCount > 0 || c.isActive)
              .map((c) => (
                <TabsTrigger key={c.id} value={c.id}>
                  {c.name}
                </TabsTrigger>
              ))}
          </TabsList>
        </Tabs>
        <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
          <form
            role="search"
            className="relative"
            onSubmit={(e) => {
              e.preventDefault();
              setQ(search.trim());
              setPage(1);
            }}
          >
            <label htmlFor="op-search" className="sr-only">
              Search operators
            </label>
            <Search
              className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              id="op-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onBlur={() => {
                setQ(search.trim());
                setPage(1);
              }}
              placeholder="Search business name"
              className="h-12 w-full rounded-input border border-line bg-surface pl-11 pr-4 text-[15px] text-ink placeholder:text-muted/70 focus-visible:border-gold focus-visible:shadow-[0_0_0_3px_rgb(var(--gold)/0.25)] focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </form>
          <Select
            aria-label="Status"
            placeholder="All statuses"
            options={OPERATOR_STATUSES.map((s) => ({
              value: s,
              label: s[0]!.toUpperCase() + s.slice(1),
            }))}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as OperatorStatus | '');
              setPage(1);
            }}
          />
        </div>
      </div>

      {ops.isError ? (
        <FormAlert>Couldn’t load operators.</FormAlert>
      ) : !ops.data ? (
        <Skeleton className="h-96 rounded-card" />
      ) : ops.data.data.length === 0 ? (
        <p className="rounded-card border border-dashed border-line px-6 py-12 text-center text-muted">
          No operators match these filters.
        </p>
      ) : (
        <>
          <DataTable label="Operators">
            <thead>
              <tr>
                <th scope="col">Operator</th>
                <th scope="col">Owner</th>
                <th scope="col">Base city</th>
                <th scope="col">Status</th>
                <th scope="col">From</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className={ops.isPlaceholderData ? 'opacity-60' : undefined}>
              {ops.data.data.map((op) => (
                <tr key={op.id}>
                  <td>
                    <Link
                      href={`/admin/operators/${op.id}`}
                      className="font-medium hover:underline"
                    >
                      {op.businessName}
                    </Link>
                    {op.isVerified && (
                      <BadgeCheck
                        className="ml-1 inline size-4 text-success"
                        aria-label="Verified"
                      />
                    )}
                  </td>
                  <td className="text-muted">
                    <div>{op.owner.name}</div>
                    <div className="text-xs">{op.owner.email}</div>
                  </td>
                  <td>{op.baseCity.name}</td>
                  <td>
                    <OperatorStatusBadge status={op.status} />
                  </td>
                  <td className="whitespace-nowrap">
                    {op.priceFrom !== null ? formatPKR(op.priceFrom) : '—'}
                  </td>
                  <td>
                    <div className="flex justify-end gap-2">
                      <OperatorStatusActions op={op} />
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/admin/operators/${op.id}`}>Edit</Link>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          {ops.data.meta.pages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-3">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft aria-hidden="true" /> Previous
              </Button>
              <span className="text-sm text-muted">
                Page {ops.data.meta.page} of {ops.data.meta.pages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= ops.data.meta.pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next <ChevronRight aria-hidden="true" />
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );
}
