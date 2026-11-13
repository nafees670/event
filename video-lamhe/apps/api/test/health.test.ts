import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildTestApp } from './helpers';

describe('health & readiness', () => {
  it('GET /api/v1/health → 200 ok', async () => {
    const res = await request(buildTestApp()).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('echoes a safe incoming request id', async () => {
    const res = await request(buildTestApp()).get('/api/v1/health').set('X-Request-Id', 'abc-123');
    expect(res.headers['x-request-id']).toBe('abc-123');
  });

  it('GET /api/v1/ready → 200 when dependencies are up', async () => {
    const res = await request(buildTestApp()).get('/api/v1/ready');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ status: 'ready', checks: { mongo: 'up', redis: 'skipped' } });
  });

  it('GET /api/v1/ready → 503 when mongo is down', async () => {
    const app = buildTestApp({ checkReadiness: async () => ({ mongo: 'down', redis: 'skipped' }) });
    const res = await request(app).get('/api/v1/ready');
    expect(res.status).toBe(503);
    expect(res.body.data.status).toBe('not_ready');
  });
});

describe('middleware', () => {
  it('unknown routes return the error envelope', async () => {
    const res = await request(buildTestApp()).get('/api/v1/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'Route GET /api/v1/nope not found' },
    });
  });

  it('sets security headers and hides x-powered-by', async () => {
    const res = await request(buildTestApp()).get('/api/v1/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
  });

  it('allows CORS only for whitelisted origins', async () => {
    const app = buildTestApp();
    const ok = await request(app).get('/api/v1/health').set('Origin', 'http://localhost:3000');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(ok.headers['access-control-allow-credentials']).toBe('true');
    const bad = await request(app).get('/api/v1/health').set('Origin', 'https://evil.example');
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('rejects malformed JSON with 400', async () => {
    const res = await request(buildTestApp())
      .post('/api/v1/health')
      .set('Content-Type', 'application/json')
      .send('{bad json');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('rejects bodies over 100kb with 413', async () => {
    const res = await request(buildTestApp())
      .post('/api/v1/health')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ x: 'a'.repeat(110_000) }));
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});
