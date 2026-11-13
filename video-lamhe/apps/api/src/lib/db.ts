import mongoose from 'mongoose';
import type { Logger } from 'pino';
import type { Env } from '../config/env.js';

/**
 * Global mongoose settings — shared by the server AND the tests so they can never drift.
 * No `sanitizeFilter`: it wraps our own `$in`/`$or` operators and breaks queries. Operator
 * injection is blocked earlier instead: express-mongo-sanitize strips `$` keys from
 * body/query/params and Zod types every input as a plain string/number.
 */
export function configureMongoose() {
  mongoose.set('strictQuery', true);
}

export async function connectMongo(env: Env, logger: Logger): Promise<typeof mongoose> {
  configureMongoose();

  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));
  mongoose.connection.on('error', (err) => logger.error({ err }, 'MongoDB error'));

  await mongoose.connect(env.MONGODB_URI, {
    maxPoolSize: env.MONGO_POOL_SIZE,
    serverSelectionTimeoutMS: 5000,
    // Indexes are created explicitly (and awaited) by ensureIndexes() at boot instead.
    autoIndex: false,
  });
  logger.info('MongoDB connected');
  return mongoose;
}

/**
 * Creates any missing index declared on a registered model (unique email, TTL on refresh
 * sessions, query indexes…). Non-destructive: never drops an index that isn't in the schema
 * (use `npm run db:indexes -- --sync` for that). Safe to run on every boot.
 */
export async function ensureIndexes(logger: Logger): Promise<void> {
  const names = mongoose.modelNames();
  for (const name of names) {
    await mongoose.model(name).createIndexes();
  }
  logger.info({ models: names.length }, 'MongoDB indexes ensured');
}

export async function pingMongo(): Promise<boolean> {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) return false;
  try {
    await mongoose.connection.db.admin().ping();
    return true;
  } catch {
    return false;
  }
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
}
