import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { useTestDb } from './db';
import { buildTestApp } from './helpers';

useTestDb();

const body = (i: number) => ({
  name: 'Proxy Test',
  phone: '03001234567',
  email: `p${i}@example.com`,
  password: 'password123',
});

describe('TRUST_PROXY', () => {
  it('with TRUST_PROXY=0 a spoofed X-Forwarded-For does not reset rate limits', async () => {
    const app = buildTestApp({ env: { TRUST_PROXY: '0' } });
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/v1/auth/register')
        .set('X-Forwarded-For', `203.0.113.${i}`)
        .send(body(i))
        .expect(201);
    }
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Forwarded-For', '203.0.113.99')
      .send(body(99));
    expect(res.status).toBe(429);
  });

  it('with TRUST_PROXY=1 each real client (as reported by the proxy) gets its own bucket', async () => {
    const app = buildTestApp({ env: { TRUST_PROXY: '1' } });
    for (let i = 0; i < 6; i++) {
      await request(app)
        .post('/api/v1/auth/register')
        .set('X-Forwarded-For', `203.0.113.${i}`)
        .send(body(i))
        .expect(201);
    }
  });
});
