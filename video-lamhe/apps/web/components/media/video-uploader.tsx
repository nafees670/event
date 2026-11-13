'use client';

import { RotateCcw, UploadCloud, X } from 'lucide-react';
import { useEffect, useRef, useState, type DragEvent } from 'react';
import type { CloudinaryUploadResult } from '@video-lamhe/shared';
import { Button, FormAlert } from '@/components/ui';
import { SHORT_LIMITS } from '@/lib/media/upload';
import { cn } from '@/lib/utils';
import { ProgressBar } from './progress-bar';
import { useUpload } from './use-upload';

/**
 * Drag & drop short upload (Section 5 admin + operator). Uploads straight to Cloudinary,
 * then reports the result; the parent submits the form with `result.public_id`.
 */
export function VideoUploader({
  onChange,
}: {
  onChange: (result: CloudinaryUploadResult | null) => void;
}) {
  const { state, start, cancel, reset } = useUpload('short', 'video', SHORT_LIMITS);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const pick = async (file?: File) => {
    if (!file) return;
    onChange(null);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(file);
    });
    onChange(await start(file));
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void pick(e.dataTransfer.files[0]);
  };

  const clear = () => {
    cancel();
    reset();
    onChange(null);
    setPreview(null);
    if (input.current) input.current.value = '';
  };

  const busy = state.status === 'checking' || state.status === 'uploading';

  return (
    <div className="flex flex-col gap-3">
      {preview && state.status !== 'error' ? (
        <div className="relative mx-auto w-full max-w-[240px] overflow-hidden rounded-media bg-black">
          <video
            src={preview}
            className="aspect-[9/16] w-full object-cover"
            muted
            playsInline
            controls
          />
          <Button
            type="button"
            size="icon"
            variant="outline"
            aria-label="Remove video"
            className="absolute right-2 top-2 size-9 bg-surface/90"
            onClick={clear}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
      ) : (
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'flex cursor-pointer flex-col items-center gap-2 rounded-card border-2 border-dashed px-6 py-10 text-center transition-colors',
            dragging
              ? 'border-gold bg-gold/10'
              : 'border-line hover:border-ink/30 hover:bg-sand/50',
          )}
        >
          <UploadCloud className="size-8 text-gold-text" aria-hidden="true" />
          <span className="font-medium">Drag a video here or click to choose</span>
          <span className="text-xs text-muted">
            MP4 / MOV · up to 60 seconds · max 100 MB · vertical works best
          </span>
          <input
            ref={input}
            type="file"
            accept="video/*"
            className="sr-only"
            onChange={(e) => void pick(e.target.files?.[0])}
          />
        </label>
      )}

      {state.status === 'checking' && <p className="text-sm text-muted">Checking video…</p>}
      {state.status === 'uploading' && (
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <ProgressBar value={state.progress} label="Uploading video" />
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={clear}>
            Cancel
          </Button>
        </div>
      )}
      {state.status === 'done' && <p className="text-sm text-success">Video uploaded ✓</p>}
      {state.status === 'error' && (
        <div className="flex flex-col gap-2">
          <FormAlert>{state.message}</FormAlert>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={clear}
            disabled={busy}
          >
            <RotateCcw aria-hidden="true" /> Choose another video
          </Button>
        </div>
      )}
    </div>
  );
}
