import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { parseEnv } from '../src/config/env';
import { signAccessToken } from '../src/lib/tokens';
import { requireAuth, requireRole } from '../src/middleware/auth';
import { createErrorHandler } from '../src/middleware/errorHandler';
import { baseEnv } from './helpers';

const env = parseEnv({ ...baseEnv });

function appWithAdminRoute() {
  const app = express();
  app.get('/admin-only', requireAuth(env), requireRole('admin'), (_req, res) => {
    res.json({ data: 'secret' });
  });
  app.use(createErrorHandler(false));
  return app;
}

const tokenFor = (role: 'customer' | 'operator' | 'admin') =>
  `Bearer ${signAccessToken(env, { sub: '507f1f77bcf86cd799439011', role })}`;

describe('requireRole', () => {
  it('401 without a token', async () => {
    expect((await request(appWithAdminRoute()).get('/admin-only')).status).toBe(401);
  });

  it('403 for the wrong role', async () => {
    const res = await request(appWithAdminRoute())
      .get('/admin-only')
      .set('Authorization', tokenFor('customer'));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('200 for the right role', async () => {
    const res = await request(appWithAdminRoute())
      .get('/admin-only')
      .set('Authorization', tokenFor('admin'));
    expect(res.status).toBe(200);
  });

  it('rejects tokens signed with another secret', async () => {
    const forged = signAccessToken(
      { ...env, JWT_ACCESS_SECRET: 'x'.repeat(32) },
      { sub: 'u', role: 'admin' },
    );
    const res = await request(appWithAdminRoute())
      .get('/admin-only')
      .set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });
});
