'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Controller, FormProvider, useForm, type Resolver } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import {
  OPERATOR_STATUSES,
  adminOperatorCreateSchema,
  adminOperatorUpdateSchema,
  type ManagedOperator,
} from '@video-lamhe/shared';
import { OperatorProfileFields, toLocalNumber } from '@/components/operator/profile-fields';
import {
  Button,
  Card,
  CardContent,
  FormAlert,
  Input,
  Select,
  Skeleton,
  Switch,
} from '@/components/ui';
import { adminCities, adminDrones, adminOperators, queryKeys } from '@/lib/api/catalog-client';
import { applyServerError } from '@/lib/forms';
import { AdminPageHeader, toastError } from './admin-page';
import { ConfirmDialog } from './confirm-dialog';
import {
  DronePricing,
  rowsFromOffers,
  rowsToInput,
  rowsValid,
  type DroneRows,
} from './drone-pricing';
import { OperatorStatusActions } from './operator-status-actions';
import { OperatorStatusBadge } from './status-badge';

type In = z.input<typeof adminOperatorCreateSchema>;
type Out = z.output<typeof adminOperatorCreateSchema>;

function defaults(op?: ManagedOperator): Partial<In> {
  if (!op) return { serviceCities: [], experienceYears: 0, status: 'active', isVerified: false };
  return {
    name: op.owner.name,
    email: op.owner.email,
    businessName: op.businessName,
    phone: toLocalNumber(op.phone),
    whatsapp: op.whatsapp === op.phone ? '' : toLocalNumber(op.whatsapp),
    baseCity: op.baseCity.id,
    serviceCities: op.serviceCities.map((c) => c.id),
    experienceYears: op.experienceYears,
    bio: op.bio ?? '',
    photoUrl: op.photoUrl ?? '',
    socialLinks: op.socialLinks,
    isVerified: op.isVerified,
  };
}

function Form({ op }: { op?: ManagedOperator }) {
  const router = useRouter();
  const qc = useQueryClient();
  const cities = useQuery({ queryKey: queryKeys.adminCities, queryFn: adminCities.list });
  const drones = useQuery({ queryKey: queryKeys.adminDrones, queryFn: adminDrones.list });
  const [rows, setRows] = useState<DroneRows>(() => rowsFromOffers(op?.drones ?? []));
  const [current, setCurrent] = useState(op);

  const form = useForm<In, unknown, Out>({
    // Edit uses the PATCH schema (no account fields, no defaults); both share the profile shape.
    resolver: zodResolver(
      op ? adminOperatorUpdateSchema : adminOperatorCreateSchema,
    ) as unknown as Resolver<In, unknown, Out>,
    defaultValues: defaults(op),
  });
  const { register, control, handleSubmit, setError, formState } = form;

  const onSubmit = handleSubmit(async (values) => {
    if (!rowsValid(rows)) {
      toast.error('Fix the drone prices first.');
      return;
    }
    try {
      if (!current) {
        const created = await adminOperators.create({ ...values, drones: rowsToInput(rows) });
        toast.success(`${created.businessName} added — invite sent to ${created.owner.email}`);
        void qc.invalidateQueries({ queryKey: ['admin', 'operators'] });
        router.replace(`/admin/operators/${created.id}`);
        return;
      }
      const { name: _n, email: _e, status: _s, drones: _d, ...profile } = values;
      await adminOperators.update(current.id, profile);
      const updated = await adminOperators.replaceDrones(current.id, rowsToInput(rows));
      setCurrent(updated);
      qc.setQueryData(queryKeys.adminOperator(current.id), updated);
      void qc.invalidateQueries({ queryKey: ['admin', 'operators'] });
      toast.success('Saved');
    } catch (err) {
      applyServerError(err, setError, { EMAIL_TAKEN: 'email', INVALID_REFERENCE: 'baseCity' });
    }
  });

  if (!cities.data || !drones.data) return <Skeleton className="h-[600px] rounded-card" />;

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
        <FormAlert>{formState.errors.root?.server?.message}</FormAlert>

        <Card>
          <CardContent className="flex flex-col gap-4">
            <h2 className="text-2xl">Owner account</h2>
            {current ? (
              <p className="text-sm text-muted">
                {current.owner.name} · {current.owner.email}
              </p>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Owner name"
                    error={formState.errors.name?.message}
                    {...register('name')}
                  />
                  <Input
                    label="Owner email"
                    type="email"
                    hint="They get an email to set their own password."
                    error={formState.errors.email?.message}
                    {...register('email')}
                  />
                </div>
                <Select
                  label="Status"
                  options={OPERATOR_STATUSES.map((s) => ({
                    value: s,
                    label: s[0]!.toUpperCase() + s.slice(1),
                  }))}
                  containerClassName="sm:w-60"
                  {...register('status')}
                />
              </>
            )}
            <Controller
              control={control}
              name="isVerified"
              render={({ field }) => (
                <Switch
                  checked={Boolean(field.value)}
                  onCheckedChange={field.onChange}
                  label="Verified badge"
                />
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-4">
            <h2 className="text-2xl">Business profile</h2>
            <OperatorProfileFields cities={cities.data} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-4">
            <h2 className="text-2xl">Drones &amp; prices</h2>
            <DronePricing models={drones.data} rows={rows} onChange={setRows} />
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button type="submit" size="lg" loading={formState.isSubmitting}>
            {current ? 'Save changes' : 'Add operator & send invite'}
          </Button>
          {current && (
            <ConfirmDialog
              title={`Remove ${current.businessName}?`}
              description="Deletes the operator profile and drones. The person keeps a customer account and is logged out. Consider deactivating instead."
              confirmLabel="Remove operator"
              onConfirm={async () => {
                try {
                  await adminOperators.remove(current.id);
                  toast.success(`${current.businessName} removed`);
                  void qc.invalidateQueries({ queryKey: ['admin', 'operators'] });
                  router.replace('/admin/operators');
                } catch (err) {
                  toast.error(toastError(err));
                }
              }}
              trigger={
                <Button type="button" variant="ghost" className="text-danger">
                  Remove operator
                </Button>
              }
            />
          )}
        </div>
      </form>
      {current && <StatusBar op={current} onChanged={setCurrent} />}
    </FormProvider>
  );
}

function StatusBar({
  op,
  onChanged,
}: {
  op: ManagedOperator;
  onChanged: (op: ManagedOperator) => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <OperatorStatusBadge status={op.status} />
          {op.status === 'active' && (
            <Link
              href={`/operators/${op.slug}`}
              target="_blank"
              className="inline-flex items-center gap-1 text-sm text-gold-text hover:underline"
            >
              Public page <ExternalLink className="size-3.5" aria-hidden="true" />
            </Link>
          )}
        </div>
        <OperatorStatusActions op={op} onChanged={onChanged} />
      </div>
    </div>
  );
}

export function OperatorAdminForm({ id }: { id?: string }) {
  const op = useQuery({
    queryKey: queryKeys.adminOperator(id ?? 'new'),
    queryFn: () => adminOperators.get(id!),
    enabled: Boolean(id),
  });
  return (
    <div className="mx-auto max-w-4xl pb-24">
      <AdminPageHeader
        title={id ? (op.data?.businessName ?? 'Operator') : 'Add operator'}
        description={
          id
            ? undefined
            : 'Creates the operator’s account and emails them a link to set their password.'
        }
        actions={
          <Button asChild variant="ghost">
            <Link href="/admin/operators">Back to operators</Link>
          </Button>
        }
      />
      {id && op.isError ? (
        <FormAlert>Couldn’t load this operator.</FormAlert>
      ) : id && !op.data ? (
        <Skeleton className="h-[600px] rounded-card" />
      ) : (
        <Form key={op.data?.id ?? 'new'} op={op.data} />
      )}
    </div>
  );
}
