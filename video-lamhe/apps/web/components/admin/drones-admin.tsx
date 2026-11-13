'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { droneModelCreateSchema, type AdminDroneModel } from '@video-lamhe/shared';
import {
  Badge,
  Button,
  Card,
  CardContent,
  FormAlert,
  Input,
  Modal,
  Skeleton,
  Textarea,
} from '@/components/ui';
import { ImageGallery } from '@/components/media/image-uploader';
import { adminDrones, queryKeys } from '@/lib/api/catalog-client';
import { formatPKR, plural } from '@/lib/format';
import { applyServerError } from '@/lib/forms';
import { AdminPageHeader, toastError } from './admin-page';
import { ConfirmDialog } from './confirm-dialog';

type In = z.input<typeof droneModelCreateSchema>;
type Out = z.output<typeof droneModelCreateSchema>;

const blankToUndef = (v: string) => v.trim() || undefined;

function DroneForm({ drone, onDone }: { drone?: AdminDroneModel; onDone: () => void }) {
  const qc = useQueryClient();
  const { register, control, handleSubmit, setError, formState } = useForm<In, unknown, Out>({
    resolver: zodResolver(droneModelCreateSchema),
    defaultValues: drone
      ? {
          name: drone.name,
          slug: drone.slug,
          tag: drone.tag ?? '',
          bestFor: drone.bestFor ?? '',
          specs: drone.specs,
          images: drone.images,
          sortOrder: drone.sortOrder,
        }
      : { sortOrder: 0, images: [] },
  });
  const e = formState.errors;
  const onSubmit = handleSubmit(async (values) => {
    try {
      if (drone)
        await adminDrones.update(drone.id, {
          ...values,
          tag: values.tag ?? '',
          bestFor: values.bestFor ?? '',
        });
      else await adminDrones.create(values);
      await qc.invalidateQueries({ queryKey: queryKeys.adminDrones });
      void qc.invalidateQueries({ queryKey: queryKeys.drones });
      toast.success(drone ? 'Drone updated' : 'Drone added');
      onDone();
    } catch (err) {
      applyServerError(err, setError, { SLUG_TAKEN: 'slug' });
    }
  });
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormAlert>{e.root?.server?.message}</FormAlert>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Model name"
          placeholder="DJI Air 3S"
          error={e.name?.message}
          {...register('name')}
        />
        <Input
          label="Tag (optional)"
          placeholder="Most booked"
          error={e.tag?.message}
          {...register('tag')}
        />
      </div>
      <Textarea
        label="Best for (optional)"
        rows={2}
        error={e.bestFor?.message}
        {...register('bestFor')}
      />
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-medium">Specs</legend>
        <Input label="Camera" {...register('specs.camera')} />
        <Input label="Video" {...register('specs.video')} />
        <Input label="Flight time" {...register('specs.flightTime')} />
        <Input label="Range" {...register('specs.range')} />
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="URL slug (optional)"
          error={e.slug?.message}
          {...register('slug', { setValueAs: blankToUndef })}
        />
        <Input
          label="Display order"
          type="number"
          min={0}
          error={e.sortOrder?.message as string | undefined}
          {...register('sortOrder')}
        />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Images (first one is the cover)</legend>
        <Controller
          control={control}
          name="images"
          render={({ field }) => (
            <ImageGallery value={field.value ?? []} onChange={field.onChange} />
          )}
        />
      </fieldset>
      <Button type="submit" loading={formState.isSubmitting} className="self-end">
        {drone ? 'Save changes' : 'Add drone'}
      </Button>
    </form>
  );
}

export function DronesAdmin() {
  const qc = useQueryClient();
  const drones = useQuery({ queryKey: queryKeys.adminDrones, queryFn: adminDrones.list });
  const [editing, setEditing] = useState<AdminDroneModel | 'new' | null>(null);

  return (
    <>
      <AdminPageHeader
        title="Drones catalogue"
        description="Models operators can list. Specs and “best for” appear on the drone pages."
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus aria-hidden="true" /> Add drone
          </Button>
        }
      />
      {drones.isError ? (
        <FormAlert>Couldn’t load drones.</FormAlert>
      ) : !drones.data ? (
        <Skeleton className="h-64 rounded-card" />
      ) : drones.data.length === 0 ? (
        <p className="text-muted">No drone models yet. Add one, or run the seed script.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {drones.data.map((d) => (
            <Card key={d.id}>
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl">{d.name}</h2>
                    <p className="font-mono text-xs text-muted">/{d.slug}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${d.name}`}
                      onClick={() => setEditing(d)}
                    >
                      <Pencil aria-hidden="true" />
                    </Button>
                    <ConfirmDialog
                      title={`Delete ${d.name}?`}
                      description="Only possible when no operator lists this drone."
                      onConfirm={async () => {
                        try {
                          await adminDrones.remove(d.id);
                          toast.success(`${d.name} deleted`);
                          void qc.invalidateQueries({ queryKey: queryKeys.adminDrones });
                        } catch (err) {
                          toast.error(toastError(err));
                        }
                      }}
                      trigger={
                        <Button variant="ghost" size="icon" aria-label={`Delete ${d.name}`}>
                          <Trash2 aria-hidden="true" />
                        </Button>
                      }
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {d.tag && <Badge variant="gold">{d.tag}</Badge>}
                  <Badge variant="outline">{plural(d.operatorCount, 'operator')}</Badge>
                  {d.priceFrom !== null && <Badge>From {formatPKR(d.priceFrom)}</Badge>}
                </div>
                {d.bestFor && <p className="text-sm text-muted">{d.bestFor}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Modal
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing === 'new' ? 'Add drone' : `Edit ${editing?.name ?? ''}`}
        className="sm:max-w-2xl"
      >
        {editing !== null && (
          <DroneForm
            drone={editing === 'new' ? undefined : editing}
            onDone={() => setEditing(null)}
          />
        )}
      </Modal>
    </>
  );
}
