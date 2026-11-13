'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import {
  shortCreateSchema,
  type CloudinaryUploadResult,
  type ManagedOperator,
  type ManagedShort,
} from '@video-lamhe/shared';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { VideoUploader } from '@/components/media/video-uploader';
import { ShortMetaFields } from '@/components/shorts/short-meta-fields';
import { ShortStatusBadge } from '@/components/shorts/short-status-badge';
import { VideoPreview } from '@/components/shorts/video-preview';
import { Button, Card, CardContent, FormAlert, Modal, Skeleton } from '@/components/ui';
import { ApiError } from '@/lib/api/client';
import { fetchCities, queryKeys } from '@/lib/api/catalog-client';
import { myShorts, shortKeys } from '@/lib/api/shorts-client';
import { eventShort } from '@/lib/events';
import { applyServerError } from '@/lib/forms';

const metaSchema = shortCreateSchema.omit({ publicId: true });
type In = z.input<typeof metaSchema>;
type Out = z.output<typeof metaSchema>;

function useOptions(op: ManagedOperator) {
  const cities = useQuery({ queryKey: queryKeys.cities, queryFn: fetchCities });
  // Operators tag shorts with the drones they list.
  const drones = op.drones.map((d) => ({ id: d.model.id, name: d.model.name }));
  return { cities: cities.data, drones };
}

function UploadShort({ op }: { op: ManagedOperator }) {
  const qc = useQueryClient();
  const { cities, drones } = useOptions(op);
  const [upload, setUpload] = useState<CloudinaryUploadResult | null>(null);
  const [key, setKey] = useState(0); // remount the uploader after a successful submit
  const form = useForm<In, unknown, Out>({
    resolver: zodResolver(metaSchema),
    defaultValues: { city: op.baseCity.id, droneModel: drones[0]?.id ?? '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    if (!upload) return;
    try {
      await myShorts.create({ ...values, publicId: upload.public_id });
      toast.success('Short sent for review — we’ll publish it after a quick check.');
      form.reset({ city: op.baseCity.id, droneModel: drones[0]?.id ?? '' });
      setUpload(null);
      setKey((k) => k + 1);
      void qc.invalidateQueries({ queryKey: shortKeys.mine });
    } catch (err) {
      applyServerError(err, form.setError);
    }
  });

  if (!cities) return <Skeleton className="h-72 rounded-card" />;
  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <FormAlert>{form.formState.errors.root?.server?.message}</FormAlert>
        <VideoUploader key={key} onChange={setUpload} />
        <ShortMetaFields cities={cities} drones={drones} />
        <Button
          type="submit"
          disabled={!upload}
          loading={form.formState.isSubmitting}
          className="self-start"
        >
          {upload ? 'Submit for review' : 'Upload a video first'}
        </Button>
      </form>
    </FormProvider>
  );
}

function EditShort({
  short,
  op,
  onDone,
}: {
  short: ManagedShort;
  op: ManagedOperator;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const { cities, drones } = useOptions(op);
  const form = useForm<In, unknown, Out>({
    resolver: zodResolver(metaSchema),
    defaultValues: {
      title: short.title,
      caption: short.caption ?? '',
      city: short.city.id,
      droneModel: short.droneModel?.id ?? '',
      eventType: short.eventType,
    },
  });
  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await myShorts.update(short.id, values);
      toast.success('Resubmitted for review');
      void qc.invalidateQueries({ queryKey: shortKeys.mine });
      onDone();
    } catch (err) {
      applyServerError(err, form.setError);
    }
  });
  if (!cities) return <Skeleton className="h-60 rounded-card" />;
  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <FormAlert>{form.formState.errors.root?.server?.message}</FormAlert>
        <ShortMetaFields cities={cities} drones={drones} />
        <Button type="submit" loading={form.formState.isSubmitting} className="self-end">
          Save &amp; resubmit
        </Button>
      </form>
    </FormProvider>
  );
}

export function MyShorts({ op }: { op: ManagedOperator }) {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: shortKeys.mine, queryFn: myShorts.list });
  const [editing, setEditing] = useState<ManagedShort | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col gap-4">
          <h3 className="text-2xl">Upload a short</h3>
          <p className="text-sm text-muted">
            Up to 60 seconds. Every upload is reviewed before it appears on Video Lamhe.
          </p>
          <UploadShort op={op} />
        </CardContent>
      </Card>

      {list.isError ? (
        <FormAlert>Couldn’t load your shorts.</FormAlert>
      ) : !list.data ? (
        <Skeleton className="h-40 rounded-card" />
      ) : list.data.length === 0 ? (
        <p className="text-sm text-muted">No shorts yet — your first upload will appear here.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {list.data.map((s) => (
            <li key={s.id} className="flex flex-col gap-2">
              <VideoPreview short={s} />
              <ShortStatusBadge status={s.status} />
              <p className="line-clamp-2 text-sm font-medium">{s.title}</p>
              <p className="text-xs text-muted">
                {eventShort(s.eventType)} · {s.city.name} · {s.views} views · {s.likeCount} likes
              </p>
              {s.rejectionReason && (
                <p className="text-xs text-danger">Reason: {s.rejectionReason}</p>
              )}
              <div className="flex gap-1">
                {s.status !== 'published' && (
                  <Button size="sm" variant="outline" onClick={() => setEditing(s)}>
                    <Pencil aria-hidden="true" /> Edit
                  </Button>
                )}
                <ConfirmDialog
                  title="Delete this short?"
                  description="The video is removed permanently."
                  onConfirm={async () => {
                    try {
                      await myShorts.remove(s.id);
                      toast.success('Short deleted');
                      void qc.invalidateQueries({ queryKey: shortKeys.mine });
                    } catch (err) {
                      toast.error(err instanceof ApiError ? err.message : 'Could not delete.');
                    }
                  }}
                  trigger={
                    <Button size="icon" variant="ghost" aria-label={`Delete ${s.title}`}>
                      <Trash2 aria-hidden="true" />
                    </Button>
                  }
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title="Edit short"
        className="sm:max-w-2xl"
      >
        {editing && <EditShort short={editing} op={op} onDone={() => setEditing(null)} />}
      </Modal>
    </div>
  );
}
