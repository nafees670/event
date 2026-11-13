import { describe, expect, it } from 'vitest';
import { formatPKR, initials, param, plural } from './format';

describe('format helpers', () => {
  it('formats PKR', () => {
    expect(formatPKR(35000)).toBe('PKR 35,000');
    expect(formatPKR(1250000)).toBe('PKR 1,250,000');
  });
  it('makes initials, ignoring sample brackets', () => {
    expect(initials('[Sample Operator 1]')).toBe('SO');
    expect(initials('Sky')).toBe('S');
    expect(initials('')).toBe('?');
  });
  it('pluralises and reads params', () => {
    expect(plural(1, 'operator')).toBe('1 operator');
    expect(plural(3, 'operator')).toBe('3 operators');
    expect(param(['a', 'b'])).toBe('a');
    expect(param('')).toBeUndefined();
  });
});
