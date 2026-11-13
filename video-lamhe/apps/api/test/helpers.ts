import { pino } from 'pino';
import type { Response } from 'supertest';
import { createApp } from '../src/app';
import { parseEnv } from '../src/config/env';
import type { MailMessage } from '../src/lib/mailer';
import type { AssetInfo, MediaService } from '../src/lib/media';
import type { ReadinessCheck } from '../src/routes/health';

export const baseEnv = {
  NODE_ENV: 'test',
  MONGODB_URI: 'mongodb://localhost:27017/test',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  WEB_URL: 'http://localhost:3000',
  BCRYPT_ROUNDS: '4',
  TRUST_PROXY: '1', // tests simulate clients behind one proxy via X-Forwarded-For
} as const;

export const TEST_CLOUD = 'test-cloud';

/** In-memory stand-in for Cloudinary: tests register "uploaded" assets in `assets`. */
export function fakeMedia() {
  const assets = new Map<string, AssetInfo>();
  const destroyed: string[] = [];
  const media: MediaService & { assets: typeof assets; destroyed: typeof destroyed } = {
    configured: true,
    cloudName: TEST_CLOUD,
    assets,
    destroyed,
    sign: (params) => ({
      signature: `sig(${Object.keys(params)
        .sort()
        .map((k) => `${k}=${params[k]}`)
        .join('&')})`,
      apiKey: 'test-key',
      cloudName: TEST_CLOUD,
    }),
    getAsset: async (publicId) => assets.get(publicId) ?? null,
    destroy: async (publicId) => {
      destroyed.push(publicId);
      assets.delete(publicId);
    },
  };
  return media;
}

export function buildTestApp(
  opts: {
    checkReadiness?: ReadinessCheck;
    env?: Record<string, string>;
    media?: MediaService;
  } = {},
) {
  const env = parseEnv({ ...baseEnv, ...opts.env });
  const sent: MailMessage[] = [];
  const media = opts.media ?? fakeMedia();
  const app = createApp({
    env,
    logger: pino({ level: 'silent' }),
    checkReadiness: opts.checkReadiness ?? (async () => ({ mongo: 'up', redis: 'skipped' })),
    mailer: {
      send: async (m) => {
        sent.push(m);
      },
    },
    media,
  });
  return Object.assign(app, { sentMail: sent, env, media: media as ReturnType<typeof fakeMedia> });
}

/** Raw `name=value` of a Set-Cookie header (for sending back as Cookie). */
export function getCookie(res: Response, name: string): string | undefined {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  return raw?.find((c) => c.startsWith(`${name}=`))?.split(';')[0];
}

export function getSetCookieHeader(res: Response, name: string): string | undefined {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  return raw?.find((c) => c.startsWith(`${name}=`));
}

import { signAccessToken } from '../src/lib/tokens';
import { User } from '../src/models/User';

/** Creates a user with a role directly in the DB and returns a Bearer header for it. */
export async function authAs(
  app: ReturnType<typeof buildTestApp>,
  role: 'customer' | 'operator' | 'admin',
  email = `${role}-${Math.random().toString(36).slice(2, 8)}@example.com`,
) {
  const user = await User.create({
    name: `Test ${role}`,
    email,
    phone: '923001234567',
    passwordHash: 'x',
    role,
  });
  return {
    user,
    header: `Bearer ${signAccessToken(app.env, { sub: user.id as string, role })}`,
  };
}

/** Any Pakistani number in normalised form anywhere in a payload. */
export const PHONE_PATTERN = /92\d{10}/;
