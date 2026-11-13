import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { configureMongoose } from '../src/lib/db';

/**
 * Connects this test file to its own throwaway database on a real MongoDB
 * (local: `npm run db:up`; CI: service container). Override with TEST_MONGODB_URI.
 */
export function useTestDb() {
  const base = process.env.TEST_MONGODB_URI ?? 'mongodb://127.0.0.1:27017';
  const dbName = `vl-test-${randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    configureMongoose(); // same settings as production
    await mongoose.connect(base, { dbName, serverSelectionTimeoutMS: 3000, autoIndex: false });
    await mongoose.connection.syncIndexes();
  });

  afterEach(async () => {
    const collections = await mongoose.connection.db!.collections();
    await Promise.all(collections.map((c) => c.deleteMany({})));
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
}
