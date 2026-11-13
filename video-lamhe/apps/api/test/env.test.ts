import { describe, expect, it } from 'vitest';
import { parseEnv } from '../src/config/env';
import { baseEnv } from './helpers';

describe('env validation', () => {
  it('parses a minimal valid env with defaults', () => {
    const env = parseEnv({ ...baseEnv });
    expect(env.PORT).toBe(4000);
    expect(env.ADMIN_WHATSAPP).toBe('923462590643');
    expect(env.WHATSAPP_ROUTING).toBe('admin');
    expect(env.WEB_URL).toEqual(['http://localhost:3000']);
    expect(env.REDIS_URL).toBeUndefined();
  });

  it('normalises ADMIN_WHATSAPP and splits WEB_URL', () => {
    const env = parseEnv({
      ...baseEnv,
      ADMIN_WHATSAPP: '0346-2590643',
      WEB_URL: 'http://localhost:3000, https://videolamhe.pk',
      REDIS_URL: '',
    });
    expect(env.ADMIN_WHATSAPP).toBe('923462590643');
    expect(env.WEB_URL).toEqual(['http://localhost:3000', 'https://videolamhe.pk']);
    expect(env.REDIS_URL).toBeUndefined();
  });

  it('refuses to boot when required vars are missing or weak', () => {
    expect(() => parseEnv({ NODE_ENV: 'test' })).toThrow(/MONGODB_URI/);
    expect(() => parseEnv({ ...baseEnv, JWT_ACCESS_SECRET: 'short' })).toThrow(/JWT_ACCESS_SECRET/);
    expect(() => parseEnv({ ...baseEnv, ADMIN_WHATSAPP: 'abc' })).toThrow(/ADMIN_WHATSAPP/);
  });

  it('requires SMTP and distinct JWT secrets in production', () => {
    expect(() => parseEnv({ ...baseEnv, NODE_ENV: 'production' })).toThrow(/SMTP_HOST/);
    expect(() =>
      parseEnv({
        ...baseEnv,
        NODE_ENV: 'production',
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: '587',
        SMTP_USER: 'u',
        SMTP_PASS: 'p',
        JWT_REFRESH_SECRET: baseEnv.JWT_ACCESS_SECRET,
      }),
    ).toThrow(/Must differ/);
  });

  it('requires TRUST_PROXY in production and defaults it off elsewhere', () => {
    const { TRUST_PROXY: _omit, ...withoutProxy } = baseEnv;
    expect(parseEnv({ ...withoutProxy }).TRUST_PROXY).toBeUndefined();
    expect(() =>
      parseEnv({
        ...withoutProxy,
        NODE_ENV: 'production',
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: '587',
        SMTP_USER: 'u',
        SMTP_PASS: 'p',
        JWT_REFRESH_SECRET: 'c'.repeat(32),
      }),
    ).toThrow(/TRUST_PROXY is required in production/);
  });
});
