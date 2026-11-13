import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import { Operator } from '../src/models/Operator';
import { User } from '../src/models/User';
import { runSeed } from '../src/seed/seed';
import { verifyPassword } from '../src/lib/password';
import { useTestDb } from './db';

useTestDb();

const opts = {
  adminEmail: 'Admin@Example.com',
  adminPassword: 'first-admin-password',
  bcryptRounds: 4,
  logger: pino({ level: 'silent' }),
};

describe('seed', () => {
  it('is idempotent and never resets the admin password', async () => {
    const first = await runSeed({
      ...opts,
      includeSamples: true,
      operatorPassword: 'sample-pass-1',
    });
    expect(first).toMatchObject({
      admin: { email: 'admin@example.com', created: true },
      cities: 12,
      drones: 4,
      operators: 6,
      shorts: 12,
    });

    const second = await runSeed({
      ...opts,
      adminPassword: 'other-password',
      includeSamples: true,
    });
    expect(second).toMatchObject({
      admin: { created: false },
      cities: 12,
      drones: 4,
      operators: 6,
      shorts: 12,
    });
    expect(await User.countDocuments()).toBe(7);

    const admin = await User.findOne({ email: 'admin@example.com' }).select('+passwordHash');
    expect(await verifyPassword('first-admin-password', admin!.passwordHash)).toBe(true);

    const pending = await Operator.countDocuments({ status: 'pending' });
    expect(pending).toBe(1);
    const { Short } = await import('../src/models/Short');
    expect(await Short.countDocuments({ status: 'published', isSample: true })).toBe(12);
    const op = await Operator.findOne({ slug: 'sample-operator-1' }).lean();
    expect(op).toMatchObject({ businessName: '[Sample Operator 1]', priceFrom: 35000 });
  });

  it('--prod mode creates no sample operators', async () => {
    const s = await runSeed({ ...opts, includeSamples: false });
    expect(s).toMatchObject({ cities: 12, drones: 4, operators: 0, shorts: 0 });
    expect(s.operatorPassword).toBeUndefined();
  });
});
