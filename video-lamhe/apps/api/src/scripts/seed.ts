/**
 * npm run seed            → admin + cities + drone models + 6 SAMPLE operators (local/staging)
 * npm run seed -- --prod  → admin + cities + drone models only (safe for production)
 *
 * Admin credentials come from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD.
 */
import mongoose from 'mongoose';
import { loadEnv } from '../config/env.js';
import { connectMongo, ensureIndexes } from '../lib/db.js';
import { createLogger } from '../lib/logger.js';
import '../models/index.js';
import { runSeed } from '../seed/seed.js';

const env = loadEnv();
const logger = createLogger({ ...env, LOG_LEVEL: 'warn' });
const prodMode = process.argv.includes('--prod');

const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim();
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? '';
if (!adminEmail || adminPassword.length < 12) {
  console.error('Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (≥ 12 chars) in .env first.');
  process.exit(1);
}
if (env.NODE_ENV === 'production' && !prodMode) {
  console.error('Refusing to create sample operators in production. Use: npm run seed -- --prod');
  process.exit(1);
}

await connectMongo(env, logger);
await ensureIndexes(logger);
const s = await runSeed({
  adminEmail,
  adminPassword,
  includeSamples: !prodMode,
  operatorPassword: process.env.SEED_OPERATOR_PASSWORD || undefined,
  bcryptRounds: env.BCRYPT_ROUNDS,
  logger,
});
await mongoose.disconnect();

console.log('\nSeed complete');
console.log(
  `  Cities: ${s.cities} · Drone models: ${s.drones} · Operators: ${s.operators} · Shorts: ${s.shorts}`,
);
console.log(
  `  Admin login: ${s.admin.email} / ${s.admin.created ? adminPassword : '(existing account — password unchanged)'}`,
);
if (s.operatorPassword) {
  console.log(
    `  Sample operator logins: sample-operator-1…6@videolamhe.test / ${s.operatorPassword}`,
  );
  console.log('  ⚠  Sample prices/specs are placeholders — edit them in the admin panel.');
}
