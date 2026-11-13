import type { Role } from '@video-lamhe/shared';

declare global {
  namespace Express {
    interface Request {
      /** Set by requireAuth / optionalAuth from a valid access token. */
      auth?: { userId: string; role: Role };
    }
  }
}

export {};
