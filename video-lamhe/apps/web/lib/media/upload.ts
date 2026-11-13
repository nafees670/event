import {
  MEDIA_LIMITS,
  type CloudinaryUploadResult,
  type UploadSignature,
  type UploadType,
} from '@video-lamhe/shared';
import { api } from '@/lib/api/client';

export class UploadError extends Error {}

const mb = (bytes: number) => Math.round(bytes / (1024 * 1024));

/** Reads a local video's duration without uploading it. */
export function readVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new UploadError('This video can’t be read. Try an MP4 or MOV file.'));
    };
    video.src = url;
  });
}

/** Browser-side checks (the API re-checks everything with Cloudinary). */
export async function validateFile(
  file: File,
  kind: 'video' | 'image',
  maxBytes: number,
  maxSeconds?: number,
) {
  if (!file.type.startsWith(`${kind}/`)) {
    throw new UploadError(
      kind === 'video' ? 'Please choose a video file.' : 'Please choose an image file.',
    );
  }
  if (file.size > maxBytes) throw new UploadError(`File is too large (max ${mb(maxBytes)} MB).`);
  if (kind === 'video' && maxSeconds) {
    const seconds = await readVideoDuration(file);
    if (seconds > maxSeconds + 0.5) {
      throw new UploadError(
        `Video is ${Math.round(seconds)} s — shorts can be at most ${maxSeconds} s.`,
      );
    }
  }
}

export const getUploadSignature = (type: UploadType) =>
  api<UploadSignature>(`/uploads/signature?type=${type}`);

/**
 * Signed direct upload to Cloudinary (the API never handles the file).
 * XMLHttpRequest because fetch() has no upload progress events.
 */
export function uploadToCloudinary(
  file: File,
  sig: UploadSignature,
  opts: { onProgress?: (fraction: number) => void; signal?: AbortSignal } = {},
): Promise<CloudinaryUploadResult> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', file);
    form.append('api_key', sig.apiKey);
    form.append('timestamp', String(sig.timestamp));
    form.append('signature', sig.signature);
    form.append('folder', sig.folder);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', sig.uploadUrl);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) opts.onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      let body: unknown = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // ignore
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body as CloudinaryUploadResult);
      else
        reject(
          new UploadError(
            (body as { error?: { message?: string } } | null)?.error?.message ??
              'Upload failed. Please try again.',
          ),
        );
    };
    xhr.onerror = () =>
      reject(new UploadError('Network error during upload. Check your connection.'));
    xhr.onabort = () => reject(new UploadError('Upload cancelled.'));
    opts.signal?.addEventListener('abort', () => xhr.abort());
    xhr.send(form);
  });
}

export const SHORT_LIMITS = {
  maxBytes: MEDIA_LIMITS.shortMaxBytes,
  maxSeconds: MEDIA_LIMITS.shortMaxSeconds,
};
export const IMAGE_LIMITS = { maxBytes: MEDIA_LIMITS.imageMaxBytes };
