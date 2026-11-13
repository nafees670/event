import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { Short } from '../src/models/Short';
import { useTestDb } from './db';
import { seedCatalog } from './fixtures';
import { PHONE_PATTERN, TEST_CLOUD, authAs, buildTestApp } from './helpers';

useTestDb();
const V = '/api/v1';

/** App + catalog + one active operator (logged in) + admin + customer. */
async function setup() {
  const app = buildTestApp();
  const cat = await seedCatalog();
  const admin = await authAs(app, 'admin');
  const customer = await authAs(app, 'customer');
  const signup = await request(app).post(`${V}/auth/register/operator`).send({
    name: 'Shorts Owner',
    email: 'shorts-op@example.com',
    password: 'password123',
    businessName: 'Reel Drones',
    baseCity: cat.karachi.id,
    phone: '03001112222',
  });
  const opAuth = `Bearer ${signup.body.data.accessToken as string}`;
  const opUserId = signup.body.data.user.id as string;
  const me = await request(app).get(`${V}/operator/me`).set('Authorization', opAuth);
  const operatorId = me.body.data.id as string;
  await request(app)
    .patch(`${V}/admin/operators/${operatorId}/status`)
    .set('Authorization', admin.header)
    .send({ status: 'active' })
    .expect(200);

  /** Simulates the browser's direct upload to Cloudinary. */
  const upload = (userId: string, name: string, info = { bytes: 5_000_000, duration: 20 }) => {
    const publicId = `video-lamhe/shorts/${userId}/${name}`;
    app.media.assets.set(publicId, info);
    return publicId;
  };
  const submit = (publicId: string, extra: Record<string, unknown> = {}) =>
    request(app)
      .post(`${V}/operator/shorts`)
      .set('Authorization', opAuth)
      .send({
        publicId,
        title: 'Barat entry',
        city: cat.karachi.id,
        droneModel: cat.air3.id,
        eventType: 'barat',
        ...extra,
      });
  const approve = (id: string, body: Record<string, unknown> = { status: 'published' }) =>
    request(app).patch(`${V}/admin/shorts/${id}`).set('Authorization', admin.header).send(body);

  return { app, cat, admin, customer, opAuth, opUserId, operatorId, upload, submit, approve };
}

describe('upload signature', () => {
  it('is auth + role gated and pins the uploader’s folder', async () => {
    const { app, opAuth, opUserId, customer, admin } = await setup();
    expect((await request(app).get(`${V}/uploads/signature?type=short`)).status).toBe(401);
    expect(
      (
        await request(app)
          .get(`${V}/uploads/signature?type=short`)
          .set('Authorization', customer.header)
      ).status,
    ).toBe(403);
    expect(
      (await request(app).get(`${V}/uploads/signature?type=drone`).set('Authorization', opAuth))
        .status,
    ).toBe(403);

    const res = await request(app)
      .get(`${V}/uploads/signature?type=short`)
      .set('Authorization', opAuth);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      uploadUrl: `https://api.cloudinary.com/v1_1/${TEST_CLOUD}/video/upload`,
      folder: `video-lamhe/shorts/${opUserId}`,
      resourceType: 'video',
      maxSeconds: 60,
      maxBytes: 100 * 1024 * 1024,
    });
    expect(res.body.data.signature).toContain(`folder=video-lamhe/shorts/${opUserId}`);
    expect(res.headers['cache-control']).toBe('no-store');

    const drone = await request(app)
      .get(`${V}/uploads/signature?type=drone`)
      .set('Authorization', admin.header);
    expect(drone.body.data.resourceType).toBe('image');
  });

  it('returns 503 when Cloudinary is not configured', async () => {
    const { createMediaService } = await import('../src/lib/media');
    const { pino } = await import('pino');
    const app = buildTestApp({
      media: createMediaService(buildTestApp().env, pino({ level: 'silent' })),
    });
    const op = await authAs(app, 'operator');
    const res = await request(app)
      .get(`${V}/uploads/signature?type=short`)
      .set('Authorization', op.header);
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('MEDIA_NOT_CONFIGURED');
  });
});

describe('operator upload → admin approval → public feed', () => {
  it('pending shorts stay private until approved, then appear (and on the featured row)', async () => {
    const { app, upload, submit, approve, opUserId } = await setup();
    const created = await submit(upload(opUserId, 'a1'));
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      status: 'pending',
      title: 'Barat entry',
      eventType: 'barat',
      durationSec: 20,
      videoUrl: `https://res.cloudinary.com/${TEST_CLOUD}/video/upload/q_auto,f_auto,w_720,du_60,ac_none/video-lamhe/shorts/${opUserId}/a1`,
      operator: { businessName: 'Reel Drones' },
    });
    const id = created.body.data.id as string;

    expect((await request(app).get(`${V}/shorts`)).body.data).toEqual([]);
    expect((await request(app).get(`${V}/shorts/${id}`)).status).toBe(404);

    const ok = await approve(id, { status: 'published', isFeatured: true });
    expect(ok.body.data).toMatchObject({ status: 'published', isFeatured: true });

    const feed = await request(app).get(`${V}/shorts`);
    expect(feed.body.data.map((s: { id: string }) => s.id)).toEqual([id]);
    expect(feed.headers['cache-control']).toContain('public');
    expect(JSON.stringify(feed.body)).not.toMatch(PHONE_PATTERN);
    expect((await request(app).get(`${V}/shorts?featured=true`)).body.data).toHaveLength(1);
  });

  it('rejects with a reason; the operator edits and it goes back to pending', async () => {
    const { app, upload, submit, approve, opAuth, opUserId } = await setup();
    const id = (await submit(upload(opUserId, 'r1'))).body.data.id as string;
    const rej = await approve(id, {
      status: 'rejected',
      rejectionReason: 'Too dark',
      isFeatured: true,
    });
    expect(rej.body.data).toMatchObject({
      status: 'rejected',
      rejectionReason: 'Too dark',
      isFeatured: false,
    });

    const mine = await request(app).get(`${V}/operator/shorts`).set('Authorization', opAuth);
    expect(mine.body.data[0]).toMatchObject({ status: 'rejected', rejectionReason: 'Too dark' });

    const edited = await request(app)
      .patch(`${V}/operator/shorts/${id}`)
      .set('Authorization', opAuth)
      .send({ title: 'Brighter barat' });
    expect(edited.body.data).toMatchObject({
      status: 'pending',
      rejectionReason: null,
      title: 'Brighter barat',
    });

    await approve(id).expect(200);
    const locked = await request(app)
      .patch(`${V}/operator/shorts/${id}`)
      .set('Authorization', opAuth)
      .send({ title: 'x y z' });
    expect(locked.status).toBe(409);
  });

  it('server re-checks every upload with Cloudinary', async () => {
    const { app, submit, upload, opUserId, customer } = await setup();
    // Someone else's folder
    const notMine = await submit(upload(customer.user.id as string, 'x'));
    expect(notMine.body.error.code).toBe('UPLOAD_NOT_YOURS');
    // Never uploaded
    expect((await submit(`video-lamhe/shorts/${opUserId}/ghost`)).body.error.code).toBe(
      'UPLOAD_NOT_FOUND',
    );
    // Too long → rejected AND deleted from Cloudinary
    const long = upload(opUserId, 'long', { bytes: 1000, duration: 75 });
    expect((await submit(long)).body.error.code).toBe('VIDEO_TOO_LONG');
    expect(app.media.destroyed).toContain(long);
    // Too big
    const big = upload(opUserId, 'big', { bytes: 101 * 1024 * 1024, duration: 30 });
    expect((await submit(big)).body.error.code).toBe('VIDEO_TOO_LARGE');
    // Same upload twice
    const once = upload(opUserId, 'once');
    expect((await submit(once)).status).toBe(201);
    expect((await submit(once)).status).toBe(409);
  });

  it('admin can upload on behalf of an operator and publish directly', async () => {
    const { app, admin, cat, operatorId, upload } = await setup();
    const res = await request(app)
      .post(`${V}/admin/shorts`)
      .set('Authorization', admin.header)
      .send({
        publicId: upload(admin.user.id as string, 'admin1'),
        operator: operatorId,
        title: 'Walima aerials',
        city: cat.lahore.id,
        eventType: 'walima',
      });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      status: 'published',
      droneModel: null,
      city: { slug: 'lahore' },
    });
    expect((await request(app).get(`${V}/shorts?city=lahore`)).body.data).toHaveLength(1);
  });
});

describe('feed', () => {
  it('cursor pagination walks every short once, newest first', async () => {
    const { app, upload, submit, approve, opUserId } = await setup();
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const id = (await submit(upload(opUserId, `p${i}`), { title: `Short number ${i}` })).body.data
        .id as string;
      await approve(id);
      ids.push(id);
    }
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const res: request.Response = await request(app).get(
        `${V}/shorts?limit=2${cursor ? `&cursor=${cursor}` : ''}`,
      );
      seen.push(...res.body.data.map((s: { id: string }) => s.id));
      cursor = res.body.meta.nextCursor;
    } while (cursor);
    expect(seen).toEqual([...ids].reverse());
    expect((await request(app).get(`${V}/shorts?cursor=garbage`)).status).toBe(400);
  });

  it('filters by city, event, drone and operator', async () => {
    const { app, cat, upload, submit, approve, opUserId } = await setup();
    const a = (await submit(upload(opUserId, 'f1'))).body.data.id as string;
    const b = (
      await submit(upload(opUserId, 'f2'), {
        city: cat.lahore.id,
        eventType: 'mehndi',
        droneModel: cat.air2s.id,
      })
    ).body.data.id as string;
    await approve(a);
    await approve(b);
    const ids = async (q: string) =>
      (await request(app).get(`${V}/shorts?${q}`)).body.data.map((s: { id: string }) => s.id);
    expect(await ids('city=lahore')).toEqual([b]);
    expect(await ids('event=barat')).toEqual([a]);
    expect(await ids('drone=dji-air-2s')).toEqual([b]);
    expect((await ids('operator=reel-drones')).sort()).toEqual([a, b].sort());
    expect(await ids('city=nowhere')).toEqual([]);
  });

  it('deactivating the operator hides their shorts; reactivating shows them again', async () => {
    const { app, admin, operatorId, upload, submit, approve, opUserId } = await setup();
    await approve((await submit(upload(opUserId, 'h1'))).body.data.id);
    const status = (s: string) =>
      request(app)
        .patch(`${V}/admin/operators/${operatorId}/status`)
        .set('Authorization', admin.header)
        .send({ status: s });
    await status('inactive').expect(200);
    expect((await request(app).get(`${V}/shorts`)).body.data).toHaveLength(0);
    await status('active').expect(200);
    expect((await request(app).get(`${V}/shorts`)).body.data).toHaveLength(1);
  });

  it('operators and drones can be filtered by event (from published shorts)', async () => {
    const { app, upload, submit, approve, opUserId } = await setup();
    await approve((await submit(upload(opUserId, 'e1'), { eventType: 'nikah' })).body.data.id);
    const slugs = async (url: string) =>
      (await request(app).get(url)).body.data.map((o: { slug: string }) => o.slug);
    expect(await slugs(`${V}/operators?event=nikah`)).toEqual(['reel-drones']);
    expect(await slugs(`${V}/operators?event=mehndi`)).toEqual([]);
    // the operator has no drones listed yet → no drones bookable for that event
    expect(await slugs(`${V}/drones?event=nikah`)).toEqual([]);
  });
});

describe('likes, saves, views', () => {
  it('like/save are login-gated, idempotent and per user', async () => {
    const { app, customer, admin, upload, submit, approve, opUserId } = await setup();
    const id = (await submit(upload(opUserId, 'l1'))).body.data.id as string;
    await approve(id);

    expect((await request(app).post(`${V}/shorts/${id}/like`)).status).toBe(401);
    const like = () =>
      request(app).post(`${V}/shorts/${id}/like`).set('Authorization', customer.header);
    expect((await like()).body.data).toEqual({ liked: true, likeCount: 1 });
    expect((await like()).body.data).toEqual({ liked: true, likeCount: 1 }); // idempotent
    await request(app)
      .post(`${V}/shorts/${id}/like`)
      .set('Authorization', admin.header)
      .expect(200);
    const unlike = await request(app)
      .delete(`${V}/shorts/${id}/like`)
      .set('Authorization', customer.header);
    expect(unlike.body.data).toEqual({ liked: false, likeCount: 1 });

    await request(app)
      .post(`${V}/shorts/${id}/save`)
      .set('Authorization', customer.header)
      .expect(200);
    const eng = await request(app)
      .get(`${V}/shorts/engagement?ids=${id}`)
      .set('Authorization', customer.header);
    expect(eng.body.data).toEqual({ liked: [], saved: [id] });
    const saved = await request(app).get(`${V}/shorts/saved`).set('Authorization', customer.header);
    expect(saved.body.data.map((s: { id: string }) => s.id)).toEqual([id]);

    // feed responses carry no viewer-specific data (they are cacheable)
    const feed = await request(app).get(`${V}/shorts`).set('Authorization', customer.header);
    expect(feed.body.data[0]).not.toHaveProperty('likedByMe');
    expect(feed.body.data[0].likeCount).toBe(1);
  });

  it('views count for guests, only on published shorts', async () => {
    const { app, upload, submit, approve, opUserId } = await setup();
    const id = (await submit(upload(opUserId, 'v1'))).body.data.id as string;
    await request(app).post(`${V}/shorts/${id}/view`).expect(200); // pending → ignored
    await approve(id);
    await request(app).post(`${V}/shorts/${id}/view`).expect(200);
    await request(app).post(`${V}/shorts/${id}/view`).expect(200);
    expect((await Short.findById(id).lean())!.views).toBe(2);
  });

  it('can’t like a short that isn’t public', async () => {
    const { app, customer, upload, submit, opUserId } = await setup();
    const id = (await submit(upload(opUserId, 'np'))).body.data.id as string;
    expect(
      (await request(app).post(`${V}/shorts/${id}/like`).set('Authorization', customer.header))
        .status,
    ).toBe(404);
  });
});

describe('deletion & media cleanup', () => {
  it('deleting a short removes its likes/saves and the Cloudinary asset', async () => {
    const { app, customer, opAuth, upload, submit, approve, opUserId } = await setup();
    const publicId = upload(opUserId, 'd1');
    const id = (await submit(publicId)).body.data.id as string;
    await approve(id);
    await request(app)
      .post(`${V}/shorts/${id}/like`)
      .set('Authorization', customer.header)
      .expect(200);
    await request(app)
      .delete(`${V}/operator/shorts/${id}`)
      .set('Authorization', opAuth)
      .expect(200);
    await new Promise((r) => setTimeout(r, 10)); // fire-and-forget destroy
    expect(app.media.destroyed).toContain(publicId);
    expect(await Short.countDocuments()).toBe(0);
  });

  it('operators can’t touch other operators’ shorts', async () => {
    const { app, upload, submit, opUserId } = await setup();
    const id = (await submit(upload(opUserId, 'o1'))).body.data.id as string;
    const other = await authAs(app, 'operator');
    // no operator profile → 404 either way; never 200
    expect(
      (await request(app).delete(`${V}/operator/shorts/${id}`).set('Authorization', other.header))
        .status,
    ).toBe(404);
  });

  it('removing an operator deletes their shorts and media', async () => {
    const { app, admin, operatorId, upload, submit, opUserId } = await setup();
    const publicId = upload(opUserId, 'gone');
    await submit(publicId).expect(201);
    await request(app)
      .delete(`${V}/admin/operators/${operatorId}`)
      .set('Authorization', admin.header)
      .expect(200);
    await new Promise((r) => setTimeout(r, 10));
    expect(await Short.countDocuments()).toBe(0);
    expect(app.media.destroyed).toContain(publicId);
  });
});

describe('photo & image media rules', () => {
  it('operator photo must be an upload to our cloud; the replaced photo is deleted', async () => {
    const { app, opAuth, opUserId } = await setup();
    const foreign = await request(app)
      .patch(`${V}/operator/me`)
      .set('Authorization', opAuth)
      .send({ photoUrl: 'https://res.cloudinary.com/someone-else/image/upload/v1/x.jpg' });
    expect(foreign.body.error.code).toBe('INVALID_MEDIA');

    const first = `https://res.cloudinary.com/${TEST_CLOUD}/image/upload/v1/video-lamhe/avatars/${opUserId}/one.jpg`;
    const second = `https://res.cloudinary.com/${TEST_CLOUD}/image/upload/v2/video-lamhe/avatars/${opUserId}/two.jpg`;
    await request(app)
      .patch(`${V}/operator/me`)
      .set('Authorization', opAuth)
      .send({ photoUrl: first })
      .expect(200);
    const r = await request(app)
      .patch(`${V}/operator/me`)
      .set('Authorization', opAuth)
      .send({ photoUrl: second });
    expect(r.body.data.photoUrl).toBe(second);
    await new Promise((res) => setTimeout(res, 10));
    expect(app.media.destroyed).toContain(`video-lamhe/avatars/${opUserId}/one`);
  });

  it('drone images must be ours; removed images are deleted', async () => {
    const { app, admin, cat } = await setup();
    const a = `https://res.cloudinary.com/${TEST_CLOUD}/image/upload/v1/video-lamhe/drones/${admin.user.id as string}/a.jpg`;
    const bad = await request(app)
      .patch(`${V}/admin/drones/${cat.air3.id}`)
      .set('Authorization', admin.header)
      .send({ images: ['https://res.cloudinary.com/other/image/upload/x.jpg'] });
    expect(bad.status).toBe(400);
    await request(app)
      .patch(`${V}/admin/drones/${cat.air3.id}`)
      .set('Authorization', admin.header)
      .send({ images: [a] })
      .expect(200);
    await request(app)
      .patch(`${V}/admin/drones/${cat.air3.id}`)
      .set('Authorization', admin.header)
      .send({ images: [] })
      .expect(200);
    await new Promise((res) => setTimeout(res, 10));
    expect(app.media.destroyed).toContain(`video-lamhe/drones/${admin.user.id as string}/a`);
  });
});
