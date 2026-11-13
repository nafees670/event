import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UploadSignature } from '@video-lamhe/shared';
import { UploadError, uploadToCloudinary, validateFile } from './upload';

const file = (type: string, size: number) => {
  const f = new File(['x'], 'f', { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
};

describe('validateFile', () => {
  it('rejects the wrong type and oversize files before uploading', async () => {
    await expect(validateFile(file('image/png', 10), 'video', 100)).rejects.toThrow(
      'Please choose a video file.',
    );
    await expect(
      validateFile(file('image/png', 11 * 1024 * 1024), 'image', 10 * 1024 * 1024),
    ).rejects.toThrow(/too large \(max 10 MB\)/);
    await expect(
      validateFile(file('image/jpeg', 1000), 'image', 10 * 1024 * 1024),
    ).resolves.toBeUndefined();
  });
});

describe('uploadToCloudinary', () => {
  const sig: UploadSignature = {
    type: 'short',
    uploadUrl: 'https://api.cloudinary.com/v1_1/c/video/upload',
    cloudName: 'c',
    apiKey: 'k',
    timestamp: 1,
    signature: 's',
    folder: 'video-lamhe/shorts/u',
    resourceType: 'video',
    maxBytes: 1,
  };
  afterEach(() => vi.unstubAllGlobals());

  function stubXhr(status: number, body: unknown) {
    const sent: FormData[] = [];
    class FakeXHR {
      status = status;
      responseText = JSON.stringify(body);
      upload: {
        onprogress?: (e: { lengthComputable: boolean; loaded: number; total: number }) => void;
      } = {};
      onload?: () => void;
      onerror?: () => void;
      onabort?: () => void;
      url = '';
      open(_m: string, url: string) {
        this.url = url;
      }
      send(form: FormData) {
        sent.push(form);
        this.upload.onprogress?.({ lengthComputable: true, loaded: 5, total: 10 });
        this.onload?.();
      }
      abort() {
        this.onabort?.();
      }
    }
    vi.stubGlobal('XMLHttpRequest', FakeXHR);
    return sent;
  }

  it('posts the signed params + file and reports progress', async () => {
    const sent = stubXhr(200, {
      public_id: 'video-lamhe/shorts/u/x',
      secure_url: 'https://x',
      bytes: 1,
      resource_type: 'video',
    });
    const progress: number[] = [];
    const r = await uploadToCloudinary(file('video/mp4', 1), sig, {
      onProgress: (p) => progress.push(p),
    });
    expect(r.public_id).toBe('video-lamhe/shorts/u/x');
    expect(progress).toEqual([0.5]);
    const form = sent[0]!;
    expect(form.get('folder')).toBe('video-lamhe/shorts/u');
    expect(form.get('signature')).toBe('s');
    expect(form.get('api_key')).toBe('k');
  });

  it('surfaces Cloudinary’s error message', async () => {
    stubXhr(400, { error: { message: 'Invalid Signature' } });
    await expect(uploadToCloudinary(file('video/mp4', 1), sig)).rejects.toEqual(
      new UploadError('Invalid Signature'),
    );
  });
});
