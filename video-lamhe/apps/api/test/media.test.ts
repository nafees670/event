import { createHash } from 'node:crypto';
import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import { parseEnv } from '../src/config/env';
import {
  createMediaService,
  folderFor,
  isOurAssetUrl,
  publicIdFromUrl,
  shortThumbnailUrl,
  shortVideoUrl,
} from '../src/lib/media';
import { baseEnv } from './helpers';

describe('media helpers', () => {
  it('builds the Section 8.2 delivery URLs', () => {
    expect(shortVideoUrl('c', 'video-lamhe/shorts/u/x')).toBe(
      'https://res.cloudinary.com/c/video/upload/q_auto,f_auto,w_720,du_60,ac_none/video-lamhe/shorts/u/x',
    );
    expect(shortThumbnailUrl('c', 'video-lamhe/shorts/u/x')).toBe(
      'https://res.cloudinary.com/c/video/upload/so_1,w_480,q_auto/video-lamhe/shorts/u/x.jpg',
    );
  });

  it('per-user folders', () => {
    expect(folderFor('short', 'abc')).toBe('video-lamhe/shorts/abc');
    expect(folderFor('avatar', 'abc')).toBe('video-lamhe/avatars/abc');
  });

  it('recognises our own assets only', () => {
    const url = 'https://res.cloudinary.com/mine/image/upload/v1712/video-lamhe/avatars/u1/pic.jpg';
    expect(isOurAssetUrl(url, 'mine', 'image')).toBe(true);
    expect(isOurAssetUrl(url, 'other', 'image')).toBe(false);
    expect(isOurAssetUrl(url, null, 'image')).toBe(false);
    expect(isOurAssetUrl(url, 'mine', 'video')).toBe(false);
    expect(publicIdFromUrl(url)).toBe('video-lamhe/avatars/u1/pic');
    expect(
      publicIdFromUrl(
        'https://res.cloudinary.com/mine/image/upload/c_fill,w_200/v1/video-lamhe/drones/u/a.png',
      ),
    ).toBe('video-lamhe/drones/u/a');
    expect(publicIdFromUrl('https://res.cloudinary.com/demo/video/upload/dog')).toBeNull();
  });

  it('real service signs exactly like Cloudinary (sha1 of sorted params + secret)', () => {
    const env = parseEnv({
      ...baseEnv,
      CLOUDINARY_CLOUD_NAME: 'mine',
      CLOUDINARY_API_KEY: 'key',
      CLOUDINARY_API_SECRET: 'secret',
    });
    const media = createMediaService(env, pino({ level: 'silent' }));
    const { signature } = media.sign({ timestamp: 1700000000, folder: 'video-lamhe/shorts/u' });
    const expected = createHash('sha1')
      .update('folder=video-lamhe/shorts/u&timestamp=1700000000secret')
      .digest('hex');
    expect(signature).toBe(expected);
  });

  it('without keys, uploads are disabled with a clear 503', async () => {
    const media = createMediaService(parseEnv({ ...baseEnv }), pino({ level: 'silent' }));
    expect(media.configured).toBe(false);
    expect(() => media.sign({ timestamp: 1 })).toThrow(/not configured/);
  });
});
