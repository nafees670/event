import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { useTestDb } from './db';
import { buildTestApp } from './helpers';

useTestDb();

describe('NoSQL operator injection', () => {
  it('a $-operator in the login body is stripped/rejected, never executed', async () => {
    const app = buildTestApp();
    await request(app).post('/api/v1/auth/register').send({
      name: 'Victim User',
      phone: '03001234567',
      email: 'victim@example.com',
      password: 'password123',
    });
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: { $ne: null }, password: { $ne: null } });
    expect(res.status).toBe(400);
  });

  it('a $-operator in query params does not reach the database', async () => {
    const res = await request(buildTestApp()).get('/api/v1/operators?city[$ne]=x');
    expect(res.status).toBe(400);
  });
});
