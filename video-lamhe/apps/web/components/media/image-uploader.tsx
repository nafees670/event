'use client';

import { ImagePlus, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { useRef } from 'react';
import type { UploadType } from '@video-lamhe/shared';
import { Button, FormAlert } from '@/components/ui';
import { IMAGE_LIMITS } from '@/lib/media/upload';
import { ProgressBar } from './progress-bar';
import { useUpload } from './use-upload';

function PickButton({
  type,
  label,
  onUploaded,
}: {
  type: UploadType;
  label: string;
  onUploaded: (url: string) => void;
}) {
  const { state, start } = useUpload(type, 'image', IMAGE_LIMITS);
  const input = useRef<HTMLInputElement>(null);
  const busy = state.status === 'checking' || state.status === 'uploading';
  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        loading={busy}
        onClick={() => input.current?.click()}
      >
        {!busy && <ImagePlus aria-hidden="true" />} {label}
      </Button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label={label}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          const r = await start(file);
          if (r) onUploaded(r.secure_url);
        }}
      />
      {state.status === 'uploading' && (
        <ProgressBar value={state.progress} label="Uploading image" />
      )}
      {state.status === 'error' && <FormAlert>{state.message}</FormAlert>}
    </div>
  );
}

/** Single image (operator photo). */
export function ImageUploader({
  value,
  onChange,
  type = 'avatar',
  label = 'Photo',
}: {
  value: string | null | undefined;
  onChange: (url: string) => void;
  type?: UploadType;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="relative size-20 shrink-0 overflow-hidden rounded-full bg-sand">
        {value && <Image src={value} alt="" fill sizes="80px" className="object-cover" />}
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">{label}</span>
        <div className="flex flex-wrap gap-2">
          <PickButton
            type={type}
            label={value ? 'Change photo' : 'Upload photo'}
            onUploaded={onChange}
          />
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange('')}>
              Remove
            </Button>
          )}
        </div>
        <span className="text-xs text-muted">JPG or PNG, max 10 MB.</span>
      </div>
    </div>
  );
}

/** Image gallery (drone images, max 6). */
export function ImageGallery({
  value,
  onChange,
  max = 6,
}: {
  value: string[];
  onChange: (urls: string[]) => void;
  max?: number;
}) {
  return (
    <div className="flex flex-col gap-3">
      {value.length > 0 && (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {value.map((url) => (
            <li key={url} className="relative aspect-[4/3] overflow-hidden rounded-media bg-sand">
              <Image src={url} alt="" fill sizes="160px" className="object-cover" />
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label="Remove image"
                className="absolute right-1 top-1 size-9 bg-surface/90"
                onClick={() => onChange(value.filter((u) => u !== url))}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {value.length < max && (
        <PickButton
          type="drone"
          label="Add image"
          onUploaded={(url) => onChange([...value, url])}
        />
      )}
    </div>
  );
}
