'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Card, CardContent, Skeleton } from '@/components/ui';
import { adminCities, adminDrones, adminOperators, queryKeys } from '@/lib/api/catalog-client';
import { adminShorts, shortKeys } from '@/lib/api/shorts-client';
import { AdminPageHeader, DataTable } from './admin-page';
import { OperatorStatusActions } from './operator-status-actions';

function Stat({ label, value, href }: { label: string; value?: number; href: string }) {
  return (
    <Card interactive className="relative">
      <CardContent>
        <p className="text-sm text-muted">{label}</p>
        {value === undefined ? (
          <Skeleton className="mt-2 h-10 w-16" />
        ) : (
          <p className="mt-1 font-serif text-5xl">
            <Link href={href} className="after:absolute after:inset-0">
              {value}
            </Link>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** Phase 2 overview — the full KPI dashboard arrives in Phase 7. */
export function AdminOverview() {
  const all = { limit: 1, page: 1 };
  const pendingQ = { status: 'pending' as const, limit: 5, page: 1 };
  const operators = useQuery({
    queryKey: queryKeys.adminOperators(all),
    queryFn: () => adminOperators.list(all),
  });
  const pending = useQuery({
    queryKey: queryKeys.adminOperators(pendingQ),
    queryFn: () => adminOperators.list(pendingQ),
  });
  const cities = useQuery({ queryKey: queryKeys.adminCities, queryFn: adminCities.list });
  const drones = useQuery({ queryKey: queryKeys.adminDrones, queryFn: adminDrones.list });
  const pendingShortsQ = { status: 'pending' as const, limit: 1, page: 1 };
  const publishedQ = { status: 'published' as const, limit: 1, page: 1 };
  const pendingShorts = useQuery({
    queryKey: shortKeys.admin(pendingShortsQ),
    queryFn: () => adminShorts.list(pendingShortsQ),
  });
  const published = useQuery({
    queryKey: shortKeys.admin(publishedQ),
    queryFn: () => adminShorts.list(publishedQ),
  });

  return (
    <>
      <AdminPageHeader
        title="Dashboard"
        description="Full stats (inquiries, reviews) arrive in later phases."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Operators" value={operators.data?.meta.total} href="/admin/operators" />
        <Stat
          label="Pending approval"
          value={pending.data?.meta.total}
          href="/admin/operators?status=pending"
        />
        <Stat
          label="Active cities"
          value={cities.data?.filter((c) => c.isActive).length}
          href="/admin/cities"
        />
        <Stat label="Drone models" value={drones.data?.length} href="/admin/drones" />
        <Stat label="Published shorts" value={published.data?.meta.total} href="/admin/shorts" />
        <Stat
          label="Shorts to review"
          value={pendingShorts.data?.meta.total}
          href="/admin/shorts"
        />
      </div>

      <section className="mt-10 flex flex-col gap-4" aria-labelledby="queue">
        <h2 id="queue" className="text-3xl">
          Approval queue
        </h2>
        {!pending.data ? (
          <Skeleton className="h-40 rounded-card" />
        ) : pending.data.data.length === 0 ? (
          <p className="text-sm text-muted">No operators waiting for approval.</p>
        ) : (
          <DataTable label="Operators waiting for approval">
            <thead>
              <tr>
                <th scope="col">Operator</th>
                <th scope="col">City</th>
                <th scope="col">Signed up</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {pending.data.data.map((op) => (
                <tr key={op.id}>
                  <td>
                    <Link
                      href={`/admin/operators/${op.id}`}
                      className="font-medium hover:underline"
                    >
                      {op.businessName}
                    </Link>
                    <div className="text-xs text-muted">{op.owner.email}</div>
                  </td>
                  <td>{op.baseCity.name}</td>
                  <td className="text-muted">
                    {new Date(op.createdAt).toLocaleDateString('en-GB')}
                  </td>
                  <td>
                    <div className="flex justify-end">
                      <OperatorStatusActions op={op} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </section>
    </>
  );
}
