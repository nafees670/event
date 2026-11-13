import { describe, expect, it } from 'vitest';
import { createMemoryLockoutStore } from '../src/lib/lockout';

describe('memory lockout store', () => {
  it('locks after N failures and unlocks after lockMs', async () => {
    let t = 0;
    const store = createMemoryLockoutStore({
      maxFailures: 3,
      windowMs: 1000,
      lockMs: 5000,
      now: () => t,
    });
    await store.registerFailure('a');
    await store.registerFailure('a');
    expect(await store.lockedFor('a')).toBe(0);
    expect((await store.registerFailure('a')).lockedFor).toBe(5000);
    t = 4999;
    expect(await store.lockedFor('a')).toBe(1);
    t = 5000;
    expect(await store.lockedFor('a')).toBe(0);
  });

  it('forgets failures outside the window', async () => {
    let t = 0;
    const store = createMemoryLockoutStore({
      maxFailures: 2,
      windowMs: 1000,
      lockMs: 5000,
      now: () => t,
    });
    await store.registerFailure('a');
    t = 2000;
    expect((await store.registerFailure('a')).lockedFor).toBe(0);
  });
});
