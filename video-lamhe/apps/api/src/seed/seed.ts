import { randomBytes } from 'node:crypto';
import type { Logger } from 'pino';
import { SEED_CITIES } from '@video-lamhe/shared';
import { hashPassword } from '../lib/password.js';
import { City } from '../models/City.js';
import { DroneModel } from '../models/DroneModel.js';
import { Operator } from '../models/Operator.js';
import { OperatorDrone } from '../models/OperatorDrone.js';
import { Short } from '../models/Short.js';
import { User } from '../models/User.js';
import { recomputePriceFrom } from '../services/catalog.js';
import { SEED_DRONES, SEED_OPERATORS, SEED_SHORTS } from './data.js';

export interface SeedOptions {
  adminEmail: string;
  adminPassword: string;
  /** false (--prod): only admin, cities and drone models — no sample operators. */
  includeSamples: boolean;
  /** Shared password for sample operator logins; generated when omitted. */
  operatorPassword?: string;
  bcryptRounds: number;
  logger: Logger;
}

export interface SeedSummary {
  admin: { email: string; created: boolean };
  cities: number;
  drones: number;
  operators: number;
  shorts: number;
  operatorPassword?: string;
}

/** Idempotent: upserts by slug/email, never duplicates, never resets an existing admin's password. */
export async function runSeed(opts: SeedOptions): Promise<SeedSummary> {
  // --- admin ---
  const email = opts.adminEmail.trim().toLowerCase();
  let admin = await User.findOne({ email });
  const adminCreated = !admin;
  if (!admin) {
    admin = await User.create({
      name: 'Admin',
      email,
      phone: '923000000000',
      passwordHash: await hashPassword(opts.adminPassword, opts.bcryptRounds),
      role: 'admin',
      isEmailVerified: true,
    });
  } else if (admin.role !== 'admin') {
    admin.role = 'admin';
    await admin.save();
  }

  // --- cities & drones (upsert by slug; existing admin edits are kept) ---
  for (const c of SEED_CITIES) {
    await City.updateOne(
      { slug: c.slug },
      { $setOnInsert: { ...c, isActive: true } },
      { upsert: true },
    );
  }
  for (const d of SEED_DRONES) {
    await DroneModel.updateOne({ slug: d.slug }, { $setOnInsert: d }, { upsert: true });
  }

  const summary: SeedSummary = {
    admin: { email, created: adminCreated },
    cities: await City.countDocuments(),
    drones: await DroneModel.countDocuments(),
    operators: 0,
    shorts: 0,
  };
  if (!opts.includeSamples) {
    summary.operators = await Operator.countDocuments();
    summary.shorts = await Short.countDocuments();
    return summary;
  }

  // --- sample operators ---
  const operatorPassword = opts.operatorPassword ?? randomBytes(9).toString('base64url');
  const passwordHash = await hashPassword(operatorPassword, opts.bcryptRounds);
  const cityId = new Map((await City.find().select('slug').lean()).map((c) => [c.slug, c._id]));
  const droneId = new Map(
    (await DroneModel.find().select('slug').lean()).map((d) => [d.slug, d._id]),
  );

  for (const s of SEED_OPERATORS) {
    const opEmail = `sample-operator-${s.n}@videolamhe.test`;
    const phone = `92300000000${s.n}`; // obviously fake
    const user = await User.findOneAndUpdate(
      { email: opEmail },
      {
        $setOnInsert: {
          name: `[Sample Owner ${s.n}]`,
          email: opEmail,
          phone,
          passwordHash,
          role: 'operator',
        },
      },
      { upsert: true, new: true },
    );
    const operator = await Operator.findOneAndUpdate(
      { slug: `sample-operator-${s.n}` },
      {
        $setOnInsert: {
          user: user._id,
          slug: `sample-operator-${s.n}`,
          businessName: `[Sample Operator ${s.n}]`,
          bio: '[Sample bio — this operator is placeholder data created by npm run seed.]',
          baseCity: cityId.get(s.base),
          serviceCities: s.serves.map((c) => cityId.get(c)),
          phone,
          whatsapp: phone,
          experienceYears: s.years,
          status: s.status,
          isVerified: s.verified,
        },
      },
      { upsert: true, new: true },
    );
    for (const [slug, pricePerEvent, pricePerHour] of s.drones) {
      await OperatorDrone.updateOne(
        { operator: operator._id, model: droneId.get(slug) },
        { $setOnInsert: { pricePerEvent, pricePerHour, isAvailable: true } },
        { upsert: true },
      );
    }
    await recomputePriceFrom(operator._id);
  }

  // --- sample shorts (published, from active sample operators) ---
  for (const s of SEED_SHORTS) {
    const op = await Operator.findOne({ slug: `sample-operator-${s.operatorN}` })
      .select('_id user baseCity')
      .lean();
    if (!op) continue;
    const drone = await OperatorDrone.findOne({ operator: op._id }).select('model').lean();
    await Short.updateOne(
      { title: `[Sample Short ${s.n}]` },
      {
        $setOnInsert: {
          title: `[Sample Short ${s.n}]`,
          caption: '[Sample caption — placeholder video from Cloudinary’s public demo account]',
          operator: op._id,
          city: op.baseCity,
          droneModel: drone?.model ?? null,
          eventType: s.eventType,
          videoUrl: s.videoUrl,
          thumbnailUrl: s.thumbnailUrl,
          durationSec: 15,
          status: 'published',
          isFeatured: s.isFeatured,
          operatorActive: true,
          uploadedBy: op.user,
          publishedAt: new Date(),
          isSample: true,
        },
      },
      { upsert: true },
    );
  }

  summary.operators = await Operator.countDocuments();
  summary.shorts = await Short.countDocuments();
  summary.operatorPassword = operatorPassword;
  opts.logger.debug('Sample operators seeded');
  return summary;
}
