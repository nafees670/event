const pkr = new Intl.NumberFormat('en-PK', { maximumFractionDigits: 0 });

/** 35000 → 'PKR 35,000' */
export const formatPKR = (amount: number) => `PKR ${pkr.format(amount)}`;

export const initials = (name: string) =>
  name
    .replace(/[[\]]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?';

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Search-param value → single string. */
export const param = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) || undefined;
