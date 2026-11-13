import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { useTestDb } from './db';
import { authAs, buildTestApp } from './helpers';

useTestDb();
const V = '/api/v1';

describe('admin cities', () => {
  it('creates (auto slug), rejects duplicate slugs, updates and deletes unused cities', async () => {
    const app = buildTestApp();
    const admin = await authAs(app, 'admin');
    const a = (r: request.Test) => r.set('Authorization', admin.header);

    const created = await a(request(app).post(`${V}/admin/cities`)).send({
      name: 'Dera Ghazi Khan',
      province: 'Punjab',
    });
    expect(created.status).toBe(201);
    const list = await a(request(app).get(`${V}/admin/cities`));
    expect(list.body.data[0]).toMatchObject({
      name: 'Dera Ghazi Khan',
      slug: 'dera-ghazi-khan',
      isActive: true,
      operatorCount: 0,
    });

    const dup = await a(request(app).post(`${V}/admin/cities`)).send({
      name: 'DG Khan',
      slug: 'dera-ghazi-khan',
      province: 'Punjab',
    });
    expect(dup.status).toBe(409);

    const bad = await a(request(app).post(`${V}/admin/cities`)).send({
      name: 'X',
      province: 'Atlantis',
    });
    expect(bad.status).toBe(400);

    const id = created.body.data.id as string;
    await a(request(app).patch(`${V}/admin/cities/${id}`))
      .send({ isActive: false })
      .expect(200);
    expect((await request(app).get(`${V}/cities`)).body.data).toEqual([]);

    await a(request(app).delete(`${V}/admin/cities/${id}`)).expect(200);
    expect((await a(request(app).get(`${V}/admin/cities`))).body.data).toEqual([]);
  });
});

describe('admin drones', () => {
  it('creates and edits drone models', async () => {
    const app = buildTestApp();
    const admin = await authAs(app, 'admin');
    const created = await request(app)
      .post(`${V}/admin/drones`)
      .set('Authorization', admin.header)
      .send({ name: 'DJI Air 3S', tag: 'Most booked', specs: { camera: '[Camera]' } });
    expect(created.status).toBe(201);

    const id = created.body.data.id as string;
    await request(app)
      .patch(`${V}/admin/drones/${id}`)
      .set('Authorization', admin.header)
      .send({ bestFor: 'Barat entries' })
      .expect(200);

    const pub = await request(app).get(`${V}/drones/dji-air-3s`);
    expect(pub.body.data.model).toMatchObject({
      name: 'DJI Air 3S',
      tag: 'Most booked',
      bestFor: 'Barat entries',
      specs: { camera: '[Camera]', video: '', flightTime: '', range: '' },
      priceFrom: null,
      operatorCount: 0,
    });

    const badImage = await request(app)
      .post(`${V}/admin/drones`)
      .set('Authorization', admin.header)
      .send({ name: 'X Drone', images: ['javascript:alert(1)'] });
    expect(badImage.status).toBe(400);
  });
});
