'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Clock, ExternalLink, OctagonX } from 'lucide-react';
import Link from 'next/link';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { operatorSelfUpdateSchema, type ManagedOperator } from '@video-lamhe/shared';
import { RequireAuth } from '@/components/auth/require-auth';
import { DashboardHeader } from '@/components/layout/dashboard-header';
import { Button, Card, CardContent, FormAlert, Skeleton } from '@/components/ui';
import { fetchCities, fetchDrones, myOperator, queryKeys } from '@/lib/api/catalog-client';
import { applyServerError } from '@/lib/forms';
import { DronesManager } from './drones-manager';
import { MyShorts } from './my-shorts';
import { OperatorProfileFields, toLocalNumber } from './profile-fields';

type In = z.input<typeof operatorSelfUpdateSchema>;
type Out = z.output<typeof operatorSelfUpdateSchema>;

function StatusBanner({ op }: { op: ManagedOperator }) {
  if (op.status === 'pending') {
    return (
      <div
        role="status"
        className="flex items-start gap-3 rounded-card border border-gold/40 bg-gold/10 p-5"
      >
        <Clock className="mt-0.5 size-5 shrink-0 text-gold-text" aria-hidden="true" />
        <div>
          <p className="font-medium">Your profile is under review</p>
          <p className="text-sm text-muted">
            Our team will approve it shortly. Meanwhile, complete your profile and add your drones
            and prices.
          </p>
        </div>
      </div>
    );
  }
  if (op.status === 'inactive') {
    return (
      <div
        role="status"
        className="flex items-start gap-3 rounded-card border border-danger/30 bg-danger/10 p-5"
      >
        <OctagonX className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden="true" />
        <div>
          <p className="font-medium">Your listing is deactivated</p>
          <p className="text-sm text-muted">
            It isn’t visible to couples. Contact the Video Lamhe team for help.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-success/30 bg-success/10 p-5"
    >
      <p className="flex items-center gap-2 font-medium">
        <BadgeCheck className="size-5 text-success" aria-hidden="true" /> Your profile is live
      </p>
      <Button asChild variant="outline" size="sm">
        <Link href={`/operators/${op.slug}`} target="_blank">
          View public profile <ExternalLink aria-hidden="true" />
        </Link>
      </Button>
    </div>
  );
}

function ProfileForm({
  op,
  onSaved,
}: {
  op: ManagedOperator;
  onSaved: (op: ManagedOperator) => void;
}) {
  const cities = useQuery({ queryKey: queryKeys.cities, queryFn: fetchCities });
  const form = useForm<In, unknown, Out>({
    resolver: zodResolver(operatorSelfUpdateSchema),
    defaultValues: {
      businessName: op.businessName,
      phone: toLocalNumber(op.phone),
      whatsapp: op.whatsapp === op.phone ? '' : toLocalNumber(op.whatsapp),
      baseCity: op.baseCity.id,
      serviceCities: op.serviceCities.map((c) => c.id),
      experienceYears: op.experienceYears,
      bio: op.bio ?? '',
      photoUrl: op.photoUrl ?? '',
      socialLinks: op.socialLinks,
    },
  });
  const onSubmit = form.handleSubmit(async (values) => {
    try {
      onSaved(await myOperator.update(values));
      toast.success('Profile saved');
    } catch (err) {
      applyServerError(err, form.setError, { INVALID_REFERENCE: 'baseCity' });
    }
  });

  if (!cities.data) return <Skeleton className="h-96 w-full rounded-card" />;
  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <FormAlert>{form.formState.errors.root?.server?.message}</FormAlert>
        <OperatorProfileFields cities={cities.data} />
        <Button type="submit" className="self-start" loading={form.formState.isSubmitting}>
          Save profile
        </Button>
      </form>
    </FormProvider>
  );
}

function Dashboard() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: queryKeys.myOperator, queryFn: myOperator.get });
  const drones = useQuery({ queryKey: queryKeys.drones, queryFn: fetchDrones });
  const setOp = (op: ManagedOperator) => qc.setQueryData(queryKeys.myOperator, op);

  if (me.isError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <FormAlert>Couldn’t load your profile. Refresh to try again.</FormAlert>
      </div>
    );
  }
  if (!me.data) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-10" aria-busy="true">
        <Skeleton className="h-20 rounded-card" />
        <Skeleton className="h-64 rounded-card" />
      </div>
    );
  }
  const op = me.data;
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-10 sm:px-6">
      <h1 className="text-5xl leading-tight">{op.businessName}</h1>
      <StatusBanner op={op} />
      <section aria-labelledby="my-drones" className="flex flex-col gap-4">
        <h2 id="my-drones" className="text-3xl">
          My drones &amp; <em className="accent">prices</em>
        </h2>
        {drones.data ? (
          <DronesManager operator={op} models={drones.data} onChange={setOp} />
        ) : (
          <Skeleton className="h-40 rounded-card" />
        )}
      </section>
      <section aria-labelledby="my-shorts" className="flex flex-col gap-4">
        <h2 id="my-shorts" className="text-3xl">
          My <em className="accent">shorts</em>
        </h2>
        <MyShorts op={op} />
      </section>
      <section aria-labelledby="profile" className="flex flex-col gap-4">
        <h2 id="profile" className="text-3xl">
          Profile
        </h2>
        <Card>
          <CardContent>
            <ProfileForm key={op.id} op={op} onSaved={setOp} />
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

export function OperatorDashboard() {
  return (
    <RequireAuth roles={['operator']}>
      <DashboardHeader label="Operator dashboard" />
      <Dashboard />
    </RequireAuth>
  );
}
