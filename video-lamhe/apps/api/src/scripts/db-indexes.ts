/**
 * npm run db:indexes            → create missing indexes (same as boot)
 * npm run db:indexes -- --sync  → also DROP indexes not declared in the schemas (careful in prod)
 */
import mongoose from 'mongoose';
import { loadEnv } from '../config/env.js';
import { connectMongo, ensureIndexes } from '../lib/db.js';
import { createLogger } from '../lib/logger.js';
import '../models/index.js';

const env = loadEnv();
const logger = createLogger(env);
await connectMongo(env, logger);
if (process.argv.includes('--sync')) {
  const dropped = await mongoose.syncIndexes();
  logger.info({ dropped }, 'Indexes synced (undeclared indexes dropped)');
} else {
  await ensureIndexes(logger);
}
await mongoose.disconnect();
