import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { pino } from 'pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { configureMongoose, ensureIndexes } from '../src/lib/db';
import '../src/models/index';

const base = process.env.TEST_MONGODB_URI ?? 'mongodb://127.0.0.1:27017';

describe('ensureIndexes (production boot path, autoIndex off)', { timeout: 30_000 }, () => {
  beforeAll(async () => {
    configureMongoose();
    await mongoose.connect(base, {
      dbName: `vl-test-idx-${randomUUID().slice(0, 8)}`,
      autoIndex: false, // same as production
      serverSelectionTimeoutMS: 3000,
    });
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it('creates the unique email index and the refresh-session TTL index', async () => {
    await ensureIndexes(pino({ level: 'silent' }));

    const userIdx = await mongoose.connection.collection('users').indexes();
    expect(userIdx.find((i) => i.key.email === 1)).toMatchObject({ unique: true });

    const sessionIdx = await mongoose.connection.collection('refreshsessions').indexes();
    expect(sessionIdx.find((i) => i.key.expiresAt === 1)).toMatchObject({ expireAfterSeconds: 0 });
    expect(sessionIdx.find((i) => i.key.jti === 1)).toMatchObject({ unique: true });
  });

  it('is idempotent (safe on every boot)', async () => {
    await expect(ensureIndexes(pino({ level: 'silent' }))).resolves.toBeUndefined();
  });
});
