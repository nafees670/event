'use client';

import { useFormContext } from 'react-hook-form';
import { EVENT_TYPES } from '@video-lamhe/shared';
import { Input, Select, Textarea } from '@/components/ui';

export interface ShortMetaValues {
  title: string;
  caption?: string;
  city: string;
  droneModel?: string;
  eventType: string;
}

/** Title / event / city / drone / caption — used by operator and admin short forms (inside a FormProvider). */
export function ShortMetaFields({
  cities,
  drones,
}: {
  cities: { id: string; name: string }[];
  drones: { id: string; name: string }[];
}) {
  const {
    register,
    formState: { errors },
  } = useFormContext<ShortMetaValues>();
  return (
    <div className="flex flex-col gap-4">
      <Input
        label="Title"
        placeholder="Barat entry at sunset"
        maxLength={80}
        error={errors.title?.message}
        {...register('title')}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Select
          label="Event"
          placeholder="Select event"
          options={EVENT_TYPES}
          error={errors.eventType?.message}
          {...register('eventType')}
        />
        <Select
          label="City"
          placeholder="Select city"
          options={cities.map((c) => ({ value: c.id, label: c.name }))}
          error={errors.city?.message}
          {...register('city')}
        />
        <Select
          label="Drone (optional)"
          placeholder="Not specified"
          options={drones.map((d) => ({ value: d.id, label: d.name }))}
          {...register('droneModel')}
        />
      </div>
      <Textarea
        label="Caption (optional)"
        rows={2}
        maxLength={300}
        error={errors.caption?.message}
        {...register('caption')}
      />
    </div>
  );
}
