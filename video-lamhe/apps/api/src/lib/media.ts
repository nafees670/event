import { v2 as cloudinary } from 'cloudinary';
import type { Logger } from 'pino';
import { MEDIA_LIMITS, type UploadType } from '@video-lamhe/shared';
import type { Env } from '../config/env.js';
import { AppError } from './errors.js';

export type ResourceType = 'video' | 'image';

export interface AssetInfo {
  bytes: number;
  /** Seconds (videos only). */
  duration?: number;
  format?: string;
}

/**
 * Everything the API needs from Cloudinary, behind an interface so tests (and dev without
 * keys) don't need a real account. The API never streams media: browsers upload directly.
 */
export interface MediaService {
  readonly configured: boolean;
  readonly cloudName: string | null;
  /** Signs upload params (Cloudinary signed upload). Throws 503 when not configured. */
  sign(params: Record<string, string | number>): {
    signature: string;
    apiKey: string;
    cloudName: string;
  };
  /** Asset facts from Cloudinary itself (never trust the browser); null if it doesn't exist. */
  getAsset(publicId: string, resourceType: ResourceType): Promise<AssetInfo | null>;
  destroy(publicId: string, resourceType: ResourceType): Promise<void>;
}

export const UPLOAD_RULES: Record<
  UploadType,
  { folder: string; resourceType: ResourceType; maxBytes: number; maxSeconds?: number }
> = {
  short: {
    folder: 'shorts',
    resourceType: 'video',
    maxBytes: MEDIA_LIMITS.shortMaxBytes,
    maxSeconds: MEDIA_LIMITS.shortMaxSeconds,
  },
  hero: {
    folder: 'heroes',
    resourceType: 'video',
    maxBytes: MEDIA_LIMITS.shortMaxBytes,
    maxSeconds: 30,
  },
  avatar: { folder: 'avatars', resourceType: 'image', maxBytes: MEDIA_LIMITS.imageMaxBytes },
  drone: { folder: 'drones', resourceType: 'image', maxBytes: MEDIA_LIMITS.imageMaxBytes },
};

/** Each uploader gets their own folder, so nobody can submit someone else's upload. */
export const folderFor = (type: UploadType, userId: string) =>
  `video-lamhe/${UPLOAD_RULES[type].folder}/${userId}`;

// ---------- delivery URLs (Section 8.2) ----------

const base = (cloud: string, kind: ResourceType) =>
  `https://res.cloudinary.com/${cloud}/${kind}/upload`;

export const shortVideoUrl = (cloud: string, publicId: string) =>
  `${base(cloud, 'video')}/q_auto,f_auto,w_720,du_60,ac_none/${publicId}`;
export const shortThumbnailUrl = (cloud: string, publicId: string) =>
  `${base(cloud, 'video')}/so_1,w_480,q_auto/${publicId}.jpg`;

/** True for an image/video URL in OUR Cloudinary account. */
export function isOurAssetUrl(url: string, cloud: string | null, kind: ResourceType): boolean {
  if (!cloud) return false;
  return url.startsWith(`${base(cloud, kind)}/`);
}

/** 'https://res.cloudinary.com/c/image/upload/v123/video-lamhe/avatars/u/x.jpg' → 'video-lamhe/avatars/u/x' */
export function publicIdFromUrl(url: string): string | null {
  const m =
    /\/(?:image|video)\/upload\/(?:[^/]+\/)*?(?:v\d+\/)?(video-lamhe\/[^.]+)(?:\.\w+)?$/.exec(url);
  return m?.[1] ?? null;
}

// ---------- implementations ----------

const notConfigured = () =>
  new AppError(
    503,
    'MEDIA_NOT_CONFIGURED',
    'Uploads are not configured on this server (Cloudinary keys missing)',
  );

export function createMediaService(env: Env, logger: Logger): MediaService {
  const {
    CLOUDINARY_CLOUD_NAME: cloudName,
    CLOUDINARY_API_KEY: apiKey,
    CLOUDINARY_API_SECRET: apiSecret,
  } = env;
  if (!cloudName || !apiKey || !apiSecret) {
    logger.warn('Cloudinary not configured — uploads disabled (set CLOUDINARY_* in .env)');
    return {
      configured: false,
      cloudName: cloudName ?? null,
      sign: () => {
        throw notConfigured();
      },
      getAsset: async () => {
        throw notConfigured();
      },
      destroy: async () => {
        throw notConfigured();
      },
    };
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });

  return {
    configured: true,
    cloudName,
    sign(params) {
      return { signature: cloudinary.utils.api_sign_request(params, apiSecret), apiKey, cloudName };
    },
    async getAsset(publicId, resourceType) {
      try {
        // explicit() returns the full upload result (incl. duration) for an existing asset.
        const r = (await cloudinary.uploader.explicit(publicId, {
          type: 'upload',
          resource_type: resourceType,
        })) as {
          bytes: number;
          duration?: number;
          format?: string;
        };
        return { bytes: r.bytes, duration: r.duration, format: r.format };
      } catch (err) {
        const code =
          (err as { http_code?: number; error?: { http_code?: number } }).http_code ??
          (err as { error?: { http_code?: number } }).error?.http_code;
        if (code === 404) return null;
        throw err;
      }
    },
    async destroy(publicId, resourceType) {
      await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
        invalidate: true,
      });
    },
  };
}

/** Fire-and-forget cleanup (moves to a BullMQ job in Phase 8). Never fails the request. */
export function destroyLater(
  media: MediaService,
  logger: Logger,
  publicId: string | null | undefined,
  kind: ResourceType,
) {
  if (!publicId || !media.configured) return;
  media
    .destroy(publicId, kind)
    .catch((err: unknown) => logger.error({ err, publicId }, 'Cloudinary destroy failed'));
}
