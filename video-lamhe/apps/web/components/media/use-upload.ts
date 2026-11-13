'use client';

import { useCallback, useRef, useState } from 'react';
import type { CloudinaryUploadResult, UploadType } from '@video-lamhe/shared';
import { ApiError } from '@/lib/api/client';
import {
  UploadError,
  getUploadSignature,
  uploadToCloudinary,
  validateFile,
} from '@/lib/media/upload';

export type UploadState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'uploading'; progress: number }
  | { status: 'done'; result: CloudinaryUploadResult }
  | { status: 'error'; message: string };

/** validate → signature → direct upload, with progress and cancel. */
export function useUpload(
  type: UploadType,
  kind: 'video' | 'image',
  limits: { maxBytes: number; maxSeconds?: number },
) {
  const [state, setState] = useState<UploadState>({ status: 'idle' });
  const abort = useRef<AbortController | null>(null);

  const start = useCallback(
    async (file: File): Promise<CloudinaryUploadResult | null> => {
      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;
      try {
        setState({ status: 'checking' });
        await validateFile(file, kind, limits.maxBytes, limits.maxSeconds);
        const sig = await getUploadSignature(type);
        setState({ status: 'uploading', progress: 0 });
        const result = await uploadToCloudinary(file, sig, {
          signal: controller.signal,
          onProgress: (progress) => setState({ status: 'uploading', progress }),
        });
        setState({ status: 'done', result });
        return result;
      } catch (err) {
        const message =
          err instanceof UploadError || err instanceof ApiError
            ? err.message
            : 'Upload failed. Please try again.';
        setState(controller.signal.aborted ? { status: 'idle' } : { status: 'error', message });
        return null;
      }
    },
    [type, kind, limits.maxBytes, limits.maxSeconds],
  );

  const cancel = useCallback(() => abort.current?.abort(), []);
  const reset = useCallback(() => setState({ status: 'idle' }), []);
  return { state, start, cancel, reset };
}
