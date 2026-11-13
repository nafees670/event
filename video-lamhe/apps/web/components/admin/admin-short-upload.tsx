'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { adminShortCreateSchema, type CloudinaryUploadResult } from '@video-lamhe/shared';
import { VideoUploader } from '@/components/media/video-uploader';
import { ShortMetaFields } from '@/components/shorts/short-meta-fields';
import { Button, FormAlert, Select, Skeleton, Switch } from '@/components/ui';
import { adminCities, adminDrones, adminOperators, queryKeys } from '@/lib/api/catalog-client';
import { adminShorts } from '@/lib/api/shorts-client';
import { applyServerError } from '@/lib/forms';

const formSchema = adminShortCreateSchema.omit({ publicId: true });
type In = z.input<typeof formSchema>;
type Out = z.output<typeof formSchema>;

/** Admin uploads a short for any active operator; can publish + feature straight away. */
export function AdminShortUpload({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const opsQuery = { status: 'active' as const, limit: 100, page: 1 };
  const ops = useQuery({
    queryKey: queryKeys.adminOperators(opsQuery),
    queryFn: () => adminOperators.list(opsQuery),
  });
  const cities = useQuery({ queryKey: queryKeys.adminCities, queryFn: adminCities.list });
  const drones = useQuery({ queryKey: queryKeys.adminDrones, queryFn: adminDrones.list });
  const [upload, setUpload] = useState<CloudinaryUploadResult | null>(null);

  const form = useForm<In, unknown, Out>({
    resolver: zodResolver(formSchema),
    defaultValues: { status: 'published', isFeatured: false },
  });
  const { register, control, handleSubmit, setError, setValue, watch, getValues, formState } = form;

  // Default the city to the chosen operator's base city.
  const operatorId = watch('operator');
  useEffect(() => {
    const op = ops.data?.data.find((o) => o.id === operatorId);
    if (op && !getValues('city')) setValue('city', op.baseCity.id);
  }, [operatorId, ops.data, getValues, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    if (!upload) return;
    try {
      await adminShorts.create({ ...values, publicId: upload.public_id });
      toast.success(values.status === 'published' ? 'Short published' : 'Saved as draft');
      void qc.invalidateQueries({ queryKey: ['admin', 'shorts'] });
      onDone();
    } catch (err) {
      applyServerError(err, setError);
    }
  });

  if (!ops.data || !cities.data || !drones.data) return <Skeleton className="h-96 rounded-card" />;

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <FormAlert>{formState.errors.root?.server?.message}</FormAlert>
        <VideoUploader onChange={setUpload} />
        <Select
          label="Operator"
          placeholder="Select operator"
          options={ops.data.data.map((o) => ({
            value: o.id,
            label: `${o.businessName} — ${o.baseCity.name}`,
          }))}
          error={formState.errors.operator?.message}
          {...register('operator')}
        />
        <ShortMetaFields cities={cities.data} drones={drones.data} />
        <div className="flex flex-wrap gap-x-6">
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Switch
                checked={field.value === 'published'}
                onCheckedChange={(on) => field.onChange(on ? 'published' : 'draft')}
                label="Publish now"
              />
            )}
          />
          <Controller
            control={control}
            name="isFeatured"
            render={({ field }) => (
              <Switch
                checked={Boolean(field.value)}
                onCheckedChange={field.onChange}
                label="Feature on Home"
              />
            )}
          />
        </div>
        <Button
          type="submit"
          size="lg"
          disabled={!upload}
          loading={formState.isSubmitting}
          className="self-end"
        >
          {upload ? 'Save short' : 'Upload a video first'}
        </Button>
      </form>
    </FormProvider>
  );
}
