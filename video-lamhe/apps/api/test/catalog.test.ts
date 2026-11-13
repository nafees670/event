import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { useTestDb } from './db';
import { seedCatalog } from './fixtures';
import { PHONE_PATTERN, authAs, buildTestApp, getCookie } from './helpers';

useTestDb();
const V = '/api/v1';

async function setup() {
  const app = buildTestApp();
  const cat = await seedCatalog();
  const admin = await authAs(app, 'admin');
  const create = (body: Record<string, unknown>) =>
    request(app).post(`${V}/admin/operators`).set('Authorization', admin.header).send(body);

  const karachiOp = await create({
    name: 'Owner One',
    email: 'one@example.com',
    businessName: 'Sky Shots Studio',
    bio: 'Barat and walima specialists',
    baseCity: cat.karachi.id,
    serviceCities: [cat.hyderabad.id, cat.karachi.id], // base city repeated → dropped
    phone: '0300-1111111',
    whatsapp: '0311-1111111',
    experienceYears: 5,
    isVerified: true,
    drones: [
      { model: cat.air2s.id, pricePerEvent: 35000 },
      { model: cat.air3.id, pricePerEvent: 45000, pricePerHour: 9000 },
    ],
  });
  const lahoreOp = await create({
    name: 'Owner Two',
    email: 'two@example.com',
    businessName: 'Lahore Aerials',
    baseCity: cat.lahore.id,
    phone: '0300-2222222',
    drones: [{ model: cat.air3.id, pricePerEvent: 60000 }],
  });
  const pendingOp = await create({
    name: 'Owner Three',
    email: 'three@example.com',
    businessName: 'Pending Pixels',
    baseCity: cat.karachi.id,
    phone: '0300-3333333',
    status: 'pending',
    drones: [{ model: cat.air2s.id, pricePerEvent: 1000 }],
  });
  return { app, cat, admin, karachiOp, lahoreOp, pendingOp };
}

const slugs = (res: request.Response) => (res.body.data as { slug: string }[]).map((o) => o.slug);

describe('admin creates operators', () => {
  it('creates the account + profile, normalises numbers and sends an invite', async () => {
    const { app, karachiOp } = await setup();
    expect(karachiOp.status).toBe(201);
    expect(karachiOp.body.data).toMatchObject({
      slug: 'sky-shots-studio',
      status: 'active',
      phone: '923001111111',
      whatsapp: '923111111111',
      priceFrom: 35000,
      owner: { email: 'one@example.com' },
    });
    expect(karachiOp.body.data.serviceCities.map((c: { slug: string }) => c.slug)).toEqual([
      'hyderabad',
    ]);
    const invite = app.sentMail.find((m) => m.to === 'one@example.com')!;
    expect(invite.subject).toMatch(/added to Video Lamhe/);
    expect(invite.text).toMatch(/reset-password\?token=/);
  });

  it('defaults WhatsApp to the phone number and rejects unknown cities / duplicate emails', async () => {
    const { app, admin, lahoreOp, cat } = await setup();
    expect(lahoreOp.body.data.whatsapp).toBe('923002222222');

    const bad = await request(app)
      .post(`${V}/admin/operators`)
      .set('Authorization', admin.header)
      .send({
        name: 'X Y',
        email: 'x@example.com',
        businessName: 'XY Films',
        baseCity: '507f1f77bcf86cd799439011',
        phone: '03001234567',
      });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('INVALID_REFERENCE');

    const dup = await request(app)
      .post(`${V}/admin/operators`)
      .set('Authorization', admin.header)
      .send({
        name: 'X Y',
        email: 'two@example.com',
        businessName: 'XY Films',
        baseCity: cat.karachi.id,
        phone: '03001234567',
      });
    expect(dup.status).toBe(409);
  });

  it('admin endpoints reject guests and non-admins', async () => {
    const app = buildTestApp();
    const customer = await authAs(app, 'customer');
    expect((await request(app).get(`${V}/admin/operators`)).status).toBe(401);
    expect(
      (await request(app).get(`${V}/admin/operators`).set('Authorization', customer.header)).status,
    ).toBe(403);
  });
});

describe('public operators', () => {
  it('lists only active operators and NEVER exposes phone/WhatsApp numbers', async () => {
    const { app } = await setup();
    const res = await request(app).get(`${V}/operators`);
    expect(res.status).toBe(200);
    expect(slugs(res).sort()).toEqual(['lahore-aerials', 'sky-shots-studio']);
    expect(res.body.meta).toEqual({ page: 1, limit: 12, total: 2, pages: 1 });
    expect(JSON.stringify(res.body)).not.toMatch(PHONE_PATTERN);
    expect(res.body.data[0]).not.toHaveProperty('phone');
    expect(res.body.data[0]).not.toHaveProperty('whatsapp');
    expect(res.body.data[0].hasWhatsapp).toBe(true);

    const detail = await request(app).get(`${V}/operators/sky-shots-studio`);
    expect(detail.status).toBe(200);
    expect(JSON.stringify(detail.body)).not.toMatch(PHONE_PATTERN);
    expect(detail.body.data).toMatchObject({
      bio: 'Barat and walima specialists',
      isVerified: true,
    });

    expect((await request(app).get(`${V}/operators/pending-pixels`)).status).toBe(404);
  });

  it('filters by city (base OR service), drone and text search; sorts by price', async () => {
    const { app } = await setup();
    expect(slugs(await request(app).get(`${V}/operators?city=hyderabad`))).toEqual([
      'sky-shots-studio',
    ]);
    expect(slugs(await request(app).get(`${V}/operators?city=lahore`))).toEqual(['lahore-aerials']);
    expect(slugs(await request(app).get(`${V}/operators?city=quetta`))).toEqual([]); // inactive city
    expect(slugs(await request(app).get(`${V}/operators?drone=dji-air-2s`))).toEqual([
      'sky-shots-studio',
    ]);
    expect(slugs(await request(app).get(`${V}/operators?q=walima`))).toEqual(['sky-shots-studio']);
    expect(slugs(await request(app).get(`${V}/operators?sort=price_desc`))).toEqual([
      'lahore-aerials',
      'sky-shots-studio',
    ]);
    expect((await request(app).get(`${V}/operators?limit=1000`)).status).toBe(400);
  });

  it('pending operators appear after admin approval', async () => {
    const { app, admin, pendingOp } = await setup();
    const r = await request(app)
      .patch(`${V}/admin/operators/${pendingOp.body.data.id}/status`)
      .set('Authorization', admin.header)
      .send({ status: 'active' });
    expect(r.status).toBe(200);
    expect(slugs(await request(app).get(`${V}/operators?city=karachi&sort=price_asc`))).toEqual([
      'pending-pixels',
      'sky-shots-studio',
    ]);
  });
});

describe('cities & drones (public)', () => {
  it('lists active cities with operator counts', async () => {
    const { app } = await setup();
    const res = await request(app).get(`${V}/cities`);
    const bySlug = Object.fromEntries(
      (res.body.data as { slug: string; operatorCount: number }[]).map((c) => [
        c.slug,
        c.operatorCount,
      ]),
    );
    expect(bySlug).toEqual({ hyderabad: 1, karachi: 1, lahore: 1 }); // quetta inactive, pending not counted
    expect((await request(app).get(`${V}/cities/quetta`)).status).toBe(404);
  });

  it('drone list carries priceFrom/operatorCount and honours city + budget filters', async () => {
    const { app } = await setup();
    const all = await request(app).get(`${V}/drones`);
    const stats = Object.fromEntries(
      (all.body.data as { slug: string; priceFrom: number; operatorCount: number }[]).map((d) => [
        d.slug,
        [d.priceFrom, d.operatorCount],
      ]),
    );
    expect(stats).toEqual({ 'dji-air-2s': [35000, 1], 'dji-air-3': [45000, 2] });

    const lahore = await request(app).get(`${V}/drones?city=lahore`);
    expect(slugs(lahore)).toEqual(['dji-air-3']);
    const cheap = await request(app).get(`${V}/drones?maxPrice=40000`);
    expect(slugs(cheap)).toEqual(['dji-air-2s']);
  });

  it('drone detail lists offers cheapest first, without numbers', async () => {
    const { app } = await setup();
    const res = await request(app).get(`${V}/drones/dji-air-3`);
    expect(res.status).toBe(200);
    expect(res.body.data.model).toMatchObject({
      slug: 'dji-air-3',
      priceFrom: 45000,
      operatorCount: 2,
    });
    expect(res.body.data.offers.map((o: { slug: string }) => o.slug)).toEqual([
      'sky-shots-studio',
      'lahore-aerials',
    ]);
    expect(JSON.stringify(res.body)).not.toMatch(PHONE_PATTERN);
    expect((await request(app).get(`${V}/drones/nope`)).status).toBe(404);
  });
});

describe('operator contact (login required)', () => {
  it('returns the admin number while routing=admin, the operator number when routing=operator', async () => {
    const { app } = await setup();
    expect((await request(app).get(`${V}/operators/sky-shots-studio/contact`)).status).toBe(401);

    const customer = await authAs(app, 'customer');
    const res = await request(app)
      .get(`${V}/operators/sky-shots-studio/contact`)
      .set('Authorization', customer.header);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      phone: '923462590643',
      whatsapp: '923462590643',
      routedTo: 'admin',
    });
    expect(new URL(res.body.data.waLink).searchParams.get('text')).toContain(
      'Operator: Sky Shots Studio',
    );
  });

  it('routing=operator reveals the operator’s own numbers', async () => {
    const app = buildTestApp({ env: { WHATSAPP_ROUTING: 'operator' } });
    const cat = await seedCatalog();
    const admin = await authAs(app, 'admin');
    await request(app).post(`${V}/admin/operators`).set('Authorization', admin.header).send({
      name: 'Owner',
      email: 'o@example.com',
      businessName: 'Solo Drone',
      baseCity: cat.karachi.id,
      phone: '0300-1111111',
      whatsapp: '0311-1111111',
    });
    const customer = await authAs(app, 'customer');
    const res = await request(app)
      .get(`${V}/operators/solo-drone/contact`)
      .set('Authorization', customer.header);
    expect(res.body.data).toMatchObject({
      phone: '923001111111',
      whatsapp: '923111111111',
      routedTo: 'operator',
    });
  });

  it('WhatsApp message uses the operator name from the DB, not the client label', async () => {
    const { app } = await setup();
    const customer = await authAs(app, 'customer');
    const res = await request(app)
      .post(`${V}/contact/whatsapp`)
      .set('Authorization', customer.header)
      .send({ operatorSlug: 'sky-shots-studio', operatorName: 'Fake Name' });
    const text = new URL(res.body.data.waLink).searchParams.get('text')!;
    expect(text).toContain('Operator: Sky Shots Studio');
    expect(text).not.toContain('Fake Name');
  });
});

describe('admin operator lifecycle', () => {
  it('deactivating an operator hides them and logs them out', async () => {
    const { app, admin, cat } = await setup();
    // An operator who signed up themselves (has a session cookie).
    const signup = await request(app).post(`${V}/auth/register/operator`).send({
      name: 'Self Signup',
      email: 'self@example.com',
      password: 'password123',
      businessName: 'Self Made Films',
      baseCity: cat.karachi.id,
      phone: '03004444444',
    });
    expect(signup.status).toBe(201);
    expect(signup.body.data.user.role).toBe('operator');
    const cookie = getCookie(signup, 'vl_rt')!;
    const me = await request(app)
      .get(`${V}/operator/me`)
      .set('Authorization', `Bearer ${signup.body.data.accessToken}`);
    expect(me.body.data).toMatchObject({ status: 'pending', slug: 'self-made-films' });

    const id = me.body.data.id as string;
    await request(app)
      .patch(`${V}/admin/operators/${id}/status`)
      .set('Authorization', admin.header)
      .send({ status: 'active' })
      .expect(200);
    expect(slugs(await request(app).get(`${V}/operators`))).toContain('self-made-films');

    await request(app)
      .patch(`${V}/admin/operators/${id}/status`)
      .set('Authorization', admin.header)
      .send({ status: 'inactive' })
      .expect(200);
    expect(slugs(await request(app).get(`${V}/operators`))).not.toContain('self-made-films');
    expect((await request(app).post(`${V}/auth/refresh`).set('Cookie', cookie)).status).toBe(401);
  });

  it('admin can edit profile + replace drones; priceFrom follows', async () => {
    const { app, admin, karachiOp, cat } = await setup();
    const id = karachiOp.body.data.id as string;
    const edit = await request(app)
      .patch(`${V}/admin/operators/${id}`)
      .set('Authorization', admin.header)
      .send({ businessName: 'Sky Shots', serviceCities: [cat.lahore.id] });
    expect(edit.body.data).toMatchObject({ businessName: 'Sky Shots', slug: 'sky-shots-studio' }); // slug stays stable
    expect(edit.body.data.serviceCities.map((c: { slug: string }) => c.slug)).toEqual(['lahore']);

    const drones = await request(app)
      .put(`${V}/admin/operators/${id}/drones`)
      .set('Authorization', admin.header)
      .send({ drones: [{ model: cat.air3.id, pricePerEvent: 50000 }] });
    expect(drones.status).toBe(200);
    expect(drones.body.data.drones).toHaveLength(1);
    expect(drones.body.data.priceFrom).toBe(50000);
  });

  it('city delete is blocked while in use; drone delete is blocked while listed', async () => {
    const { app, admin, cat } = await setup();
    const city = await request(app)
      .delete(`${V}/admin/cities/${cat.karachi.id}`)
      .set('Authorization', admin.header);
    expect(city.status).toBe(409);
    expect(city.body.error.code).toBe('CITY_IN_USE');
    const drone = await request(app)
      .delete(`${V}/admin/drones/${cat.air3.id}`)
      .set('Authorization', admin.header);
    expect(drone.status).toBe(409);
  });
});
