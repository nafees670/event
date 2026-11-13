import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { useTestDb } from './db';
import { seedCatalog } from './fixtures';
import { authAs, buildTestApp } from './helpers';

useTestDb();
const V = '/api/v1';

async function signup() {
  const app = buildTestApp();
  const cat = await seedCatalog();
  const res = await request(app)
    .post(`${V}/auth/register/operator`)
    .send({
      name: 'Self Owner',
      email: 'self@example.com',
      password: 'password123',
      businessName: 'My Drone Co',
      baseCity: cat.karachi.id,
      serviceCities: [cat.lahore.id],
      phone: '0300-5555555',
      experienceYears: 3,
    });
  expect(res.status).toBe(201);
  return { app, cat, auth: `Bearer ${res.body.data.accessToken as string}` };
}

describe('operator self-service', () => {
  it('manages own drones; priceFrom tracks available priced drones', async () => {
    const { app, cat, auth } = await signup();
    const add = await request(app)
      .post(`${V}/operator/drones`)
      .set('Authorization', auth)
      .send({ model: cat.air3.id, pricePerEvent: 48000 });
    expect(add.status).toBe(201);
    expect(add.body.data.priceFrom).toBe(48000);

    const dup = await request(app)
      .post(`${V}/operator/drones`)
      .set('Authorization', auth)
      .send({ model: cat.air3.id });
    expect(dup.status).toBe(409);

    await request(app)
      .post(`${V}/operator/drones`)
      .set('Authorization', auth)
      .send({ model: cat.air2s.id, pricePerEvent: 30000 })
      .expect(201);
    const offerId = (
      await request(app).get(`${V}/operator/me`).set('Authorization', auth)
    ).body.data.drones.find((d: { model: { slug: string } }) => d.model.slug === 'dji-air-2s')
      .id as string;

    const hidden = await request(app)
      .patch(`${V}/operator/drones/${offerId}`)
      .set('Authorization', auth)
      .send({ isAvailable: false });
    expect(hidden.body.data.priceFrom).toBe(48000);

    const cleared = await request(app)
      .patch(`${V}/operator/drones/${offerId}`)
      .set('Authorization', auth)
      .send({ pricePerEvent: null, isAvailable: true });
    const offer = cleared.body.data.drones.find((d: { id: string }) => d.id === offerId);
    expect(offer).toMatchObject({ pricePerEvent: null, isAvailable: true });
    expect(cleared.body.data.priceFrom).toBe(48000); // unpriced offers don't lower priceFrom

    const removed = await request(app)
      .delete(`${V}/operator/drones/${offerId}`)
      .set('Authorization', auth);
    expect(removed.body.data.drones).toHaveLength(1);
  });

  it('can edit the profile but not status/verification, and cannot touch other operators’ drones', async () => {
    const { app, auth } = await signup();
    const r = await request(app)
      .patch(`${V}/operator/me`)
      .set('Authorization', auth)
      .send({ bio: 'Updated bio', status: 'active', isVerified: true, rating: 5 });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({
      bio: 'Updated bio',
      status: 'pending',
      isVerified: false,
      rating: 0,
    });

    const other = await request(app)
      .patch(`${V}/operator/drones/507f1f77bcf86cd799439011`)
      .set('Authorization', auth)
      .send({ pricePerEvent: 1 });
    expect(other.status).toBe(404);
  });

  it('PATCH of one field keeps the others; empty values clear optional fields', async () => {
    const { app, auth } = await signup();
    const r = await request(app)
      .patch(`${V}/operator/me`)
      .set('Authorization', auth)
      .send({ bio: 'Short bio' });
    expect(r.body.data).toMatchObject({ bio: 'Short bio', experienceYears: 3 });
    expect(r.body.data.serviceCities.map((c: { slug: string }) => c.slug)).toEqual(['lahore']);

    const cleared = await request(app)
      .patch(`${V}/operator/me`)
      .set('Authorization', auth)
      .send({ bio: '', whatsapp: '' });
    expect(cleared.body.data).toMatchObject({
      bio: null,
      whatsapp: '923005555555',
      experienceYears: 3,
    });
  });

  it('is operator-only', async () => {
    const app = buildTestApp();
    const customer = await authAs(app, 'customer');
    expect(
      (await request(app).get(`${V}/operator/me`).set('Authorization', customer.header)).status,
    ).toBe(403);
  });
});
