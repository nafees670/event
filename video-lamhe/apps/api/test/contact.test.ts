import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { Setting } from '../src/models/Setting';
import { useTestDb } from './db';
import { buildTestApp } from './helpers';

useTestDb();

async function loginToken(app: ReturnType<typeof buildTestApp>) {
  const res = await request(app).post('/api/v1/auth/register').send({
    name: 'Guest Turned Customer',
    phone: '03001234567',
    email: 'c@example.com',
    password: 'password123',
  });
  return res.body.data.accessToken as string;
}

describe('POST /contact/whatsapp', () => {
  it('requires login (server-side gate, not just UI)', async () => {
    const res = await request(buildTestApp()).post('/api/v1/contact/whatsapp').send({});
    expect(res.status).toBe(401);
  });

  it('returns the admin WhatsApp link with the picker choice in the message', async () => {
    const app = buildTestApp();
    const token = await loginToken(app);
    const res = await request(app)
      .post('/api/v1/contact/whatsapp')
      .set('Authorization', `Bearer ${token}`)
      .send({
        eventType: 'barat',
        operatorName: '[Sample Operator 1]',
        droneName: 'DJI Air 2S',
        cityName: 'Karachi',
        eventDate: '2026-12-12',
        note: 'Evening event',
      });
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.data.whatsapp).toBe('923462590643');
    const url = new URL(res.body.data.waLink);
    expect(url.origin + url.pathname).toBe('https://wa.me/923462590643');
    expect(url.searchParams.get('text')).toBe(
      'Assalam o Alaikum! Mujhe Barat ke liye drone shoot chahiye.\n' +
        'Operator: [Sample Operator 1] · Drone: DJI Air 2S · City: Karachi · Date: 12 Dec 2026\n' +
        'Note: Evening event\n' +
        '(Video Lamhe website)',
    );
  });

  it('uses the admin-configured number when set', async () => {
    const app = buildTestApp();
    const token = await loginToken(app);
    await Setting.create({ key: 'contact', value: { whatsappNumber: '0311-0000000' } });
    const res = await request(app)
      .post('/api/v1/contact/whatsapp')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.body.data.whatsapp).toBe('923110000000');
  });

  it('validates the event type', async () => {
    const app = buildTestApp();
    const token = await loginToken(app);
    const res = await request(app)
      .post('/api/v1/contact/whatsapp')
      .set('Authorization', `Bearer ${token}`)
      .send({ eventType: 'birthday' });
    expect(res.status).toBe(400);
  });
});

describe('GET /settings/contact', () => {
  it('is public, cacheable and never exposes a phone number', async () => {
    const res = await request(buildTestApp()).get('/api/v1/settings/contact');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=300');
    expect(res.body.data.welcomeTitle).toContain('Aap ko kya chahiye?');
    expect(res.body.data.eventOptions).toHaveLength(6);
    expect(JSON.stringify(res.body)).not.toMatch(/92\d{10}/);
  });
});
