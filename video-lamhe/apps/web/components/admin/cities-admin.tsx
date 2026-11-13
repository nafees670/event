'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { PROVINCES, cityCreateSchema, type AdminCity } from '@video-lamhe/shared';
import { Button, FormAlert, Input, Modal, Select, Skeleton, Switch } from '@/components/ui';
import { adminCities, queryKeys } from '@/lib/api/catalog-client';
import { applyServerError } from '@/lib/forms';
import { AdminPageHeader, DataTable, toastError } from './admin-page';
import { ConfirmDialog } from './confirm-dialog';

type In = z.input<typeof cityCreateSchema>;
type Out = z.output<typeof cityCreateSchema>;

function CityForm({ city, onDone }: { city?: AdminCity; onDone: () => void }) {
  const qc = useQueryClient();
  const form = useForm<In, unknown, Out>({
    resolver: zodResolver(cityCreateSchema),
    defaultValues: city
      ? {
          name: city.name,
          slug: city.slug,
          province: city.province as Out['province'],
          isActive: city.isActive,
        }
      : { isActive: true },
  });
  const { register, control, handleSubmit, setError, formState } = form;
  const onSubmit = handleSubmit(async (values) => {
    try {
      if (city) await adminCities.update(city.id, values);
      else await adminCities.create(values);
      await qc.invalidateQueries({ queryKey: queryKeys.adminCities });
      void qc.invalidateQueries({ queryKey: queryKeys.cities });
      toast.success(city ? 'City updated' : 'City added');
      onDone();
    } catch (err) {
      applyServerError(err, setError, { SLUG_TAKEN: 'slug' });
    }
  });
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormAlert>{formState.errors.root?.server?.message}</FormAlert>
      <Input label="City name" error={formState.errors.name?.message} {...register('name')} />
      <Select
        label="Province"
        placeholder="Select province"
        options={PROVINCES.map((p) => ({ value: p, label: p }))}
        error={formState.errors.province?.message}
        {...register('province')}
      />
      <Input
        label="URL slug (optional)"
        hint="Used in /cities/<slug>. Leave empty to generate from the name."
        error={formState.errors.slug?.message}
        {...register('slug', { setValueAs: (v: string) => v.trim() || undefined })}
      />
      <Controller
        control={control}
        name="isActive"
        render={({ field }) => (
          <Switch
            checked={field.value ?? true}
            onCheckedChange={field.onChange}
            label="Active (visible on the site)"
          />
        )}
      />
      <Button type="submit" loading={formState.isSubmitting} className="self-end">
        {city ? 'Save changes' : 'Add city'}
      </Button>
    </form>
  );
}

export function CitiesAdmin() {
  const qc = useQueryClient();
  const cities = useQuery({ queryKey: queryKeys.adminCities, queryFn: adminCities.list });
  const [editing, setEditing] = useState<AdminCity | 'new' | null>(null);
  const toggle = useMutation({
    mutationFn: (c: AdminCity) => adminCities.update(c.id, { isActive: !c.isActive }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.adminCities });
      void qc.invalidateQueries({ queryKey: queryKeys.cities });
    },
    onError: (err) => toast.error(toastError(err)),
  });

  return (
    <>
      <AdminPageHeader
        title="Cities"
        description="Cities shown in filters, city pages and operator profiles."
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus aria-hidden="true" /> Add city
          </Button>
        }
      />
      {cities.isError ? (
        <FormAlert>Couldn’t load cities.</FormAlert>
      ) : !cities.data ? (
        <Skeleton className="h-80 rounded-card" />
      ) : (
        <DataTable label="Cities">
          <thead>
            <tr>
              <th scope="col">City</th>
              <th scope="col">Province</th>
              <th scope="col">Slug</th>
              <th scope="col">Operators</th>
              <th scope="col">Active</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {cities.data.map((c) => (
              <tr key={c.id}>
                <td className="font-medium">{c.name}</td>
                <td className="text-muted">{c.province}</td>
                <td className="font-mono text-xs text-muted">{c.slug}</td>
                <td>{c.operatorCount}</td>
                <td>
                  <Switch
                    hideLabel
                    label={`${c.name} active`}
                    checked={c.isActive}
                    disabled={toggle.isPending}
                    onCheckedChange={() => toggle.mutate(c)}
                  />
                </td>
                <td>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${c.name}`}
                      onClick={() => setEditing(c)}
                    >
                      <Pencil aria-hidden="true" />
                    </Button>
                    <ConfirmDialog
                      title={`Delete ${c.name}?`}
                      description="Only possible when no operator uses this city. Deactivating hides it instead."
                      onConfirm={async () => {
                        try {
                          await adminCities.remove(c.id);
                          toast.success(`${c.name} deleted`);
                          void qc.invalidateQueries({ queryKey: queryKeys.adminCities });
                        } catch (err) {
                          toast.error(toastError(err));
                        }
                      }}
                      trigger={
                        <Button variant="ghost" size="icon" aria-label={`Delete ${c.name}`}>
                          <Trash2 aria-hidden="true" />
                        </Button>
                      }
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}
      <Modal
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing === 'new' ? 'Add city' : `Edit ${editing?.name ?? ''}`}
      >
        {editing !== null && (
          <CityForm
            city={editing === 'new' ? undefined : editing}
            onDone={() => setEditing(null)}
          />
        )}
      </Modal>
    </>
  );
}
