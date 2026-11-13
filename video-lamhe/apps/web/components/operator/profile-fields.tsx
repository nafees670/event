'use client';

import { Controller, useFormContext } from 'react-hook-form';
import { ImageUploader } from '@/components/media/image-uploader';
import { Chip, Input, Select, Textarea } from '@/components/ui';

/** Form values shared by every operator form (signup, admin add/edit, own profile). */
export interface OperatorProfileValues {
  businessName: string;
  phone: string;
  whatsapp?: string;
  baseCity: string;
  serviceCities: string[];
  experienceYears?: unknown;
  bio?: string;
  photoUrl?: string;
  socialLinks?: {
    instagram?: string;
    facebook?: string;
    youtube?: string;
    tiktok?: string;
    website?: string;
  };
}

const SOCIAL = [
  ['instagram', 'Instagram URL'],
  ['facebook', 'Facebook URL'],
  ['youtube', 'YouTube URL'],
  ['tiktok', 'TikTok URL'],
  ['website', 'Website'],
] as const;

/**
 * Operator profile fields — must be rendered inside a react-hook-form <FormProvider>.
 * `cities` = selectable cities (admin sees inactive ones too).
 */
export function OperatorProfileFields({
  cities,
  showSocial = true,
  showPhoto = true,
}: {
  cities: { id: string; name: string; isActive?: boolean }[];
  showSocial?: boolean;
  /** Uploads need a logged-in operator/admin, so signup hides it. */
  showPhoto?: boolean;
}) {
  const {
    register,
    control,
    watch,
    formState: { errors },
  } = useFormContext<OperatorProfileValues>();
  const baseCity = watch('baseCity');
  const cityOptions = cities.map((c) => ({
    value: c.id,
    label: c.isActive === false ? `${c.name} (inactive)` : c.name,
  }));

  return (
    <div className="flex flex-col gap-5">
      {showPhoto && (
        <Controller
          control={control}
          name="photoUrl"
          render={({ field }) => (
            <div className="flex flex-col gap-1">
              <ImageUploader
                value={field.value}
                onChange={field.onChange}
                label="Business photo / logo"
              />
              {errors.photoUrl?.message && (
                <p className="text-sm text-danger">{errors.photoUrl.message}</p>
              )}
            </div>
          )}
        />
      )}
      <Input
        label="Business name"
        error={errors.businessName?.message}
        {...register('businessName')}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          label="Mobile number"
          type="tel"
          inputMode="tel"
          placeholder="0300 1234567"
          hint="Private — never shown publicly."
          error={errors.phone?.message}
          {...register('phone')}
        />
        <Input
          label="WhatsApp (optional)"
          type="tel"
          inputMode="tel"
          placeholder="Same as mobile"
          hint="Private — leave empty to use the mobile number."
          error={errors.whatsapp?.message}
          {...register('whatsapp')}
        />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Select
          label="Base city"
          placeholder="Select city"
          options={cityOptions}
          error={errors.baseCity?.message}
          {...register('baseCity')}
        />
        <Input
          label="Years of experience"
          type="number"
          inputMode="numeric"
          min={0}
          max={60}
          error={errors.experienceYears?.message as string | undefined}
          {...register('experienceYears')}
        />
      </div>

      <Controller
        control={control}
        name="serviceCities"
        render={({ field }) => (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">Also serves (optional)</legend>
            <div className="flex flex-wrap gap-2">
              {cities
                .filter((c) => c.id !== baseCity)
                .map((c) => {
                  const selected = field.value?.includes(c.id) ?? false;
                  return (
                    <Chip
                      key={c.id}
                      selected={selected}
                      onClick={() =>
                        field.onChange(
                          selected
                            ? field.value.filter((v) => v !== c.id)
                            : [...(field.value ?? []), c.id],
                        )
                      }
                    >
                      {c.name}
                    </Chip>
                  );
                })}
            </div>
          </fieldset>
        )}
      />

      <Textarea
        label="About (optional)"
        rows={5}
        maxLength={2000}
        placeholder="Events you cover, style, team…"
        error={errors.bio?.message}
        {...register('bio')}
      />

      {showSocial && (
        <details className="group rounded-media border border-line p-4">
          <summary className="cursor-pointer text-sm font-medium">Social links (optional)</summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {SOCIAL.map(([key, label]) => (
              <Input
                key={key}
                label={label}
                type="url"
                placeholder="https://"
                error={errors.socialLinks?.[key]?.message}
                {...register(`socialLinks.${key}` as const)}
              />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

/** ManagedOperator → form values ('923001234567' → '03001234567'). */
export function toLocalNumber(n: string | undefined) {
  return n?.startsWith('92') ? `0${n.slice(2)}` : (n ?? '');
}
