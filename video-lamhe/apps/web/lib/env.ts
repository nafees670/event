import { z } from 'zod';

/**
 * Public (browser-exposed) env. Each var is referenced explicitly so Next.js can inline it.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.url().default('http://localhost:4000/api/v1'),
  NEXT_PUBLIC_SOCKET_URL: z.url().default('http://localhost:4000'),
  NEXT_PUBLIC_ADMIN_WHATSAPP: z
    .string()
    .regex(/^\d{10,15}$/)
    .default('923462590643'),
});

const empty = (v: string | undefined) => (v === '' ? undefined : v);

export const publicEnv = publicEnvSchema.parse({
  NEXT_PUBLIC_API_URL: empty(process.env.NEXT_PUBLIC_API_URL),
  NEXT_PUBLIC_SOCKET_URL: empty(process.env.NEXT_PUBLIC_SOCKET_URL),
  NEXT_PUBLIC_ADMIN_WHATSAPP: empty(process.env.NEXT_PUBLIC_ADMIN_WHATSAPP),
});
