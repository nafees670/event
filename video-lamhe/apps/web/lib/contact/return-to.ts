/** Only same-site relative paths — prevents open redirects via ?returnTo=. */
export function sanitizeReturnTo(value: string | null | undefined, fallback = '/'): string {
  if (!value) return fallback;
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback;
  // eslint-disable-next-line no-control-regex -- rejecting control chars is the point
  if (/[\u0000-\u001f]/.test(value)) return fallback;
  return value;
}

/** '/shorts?city=x#y' → '/shorts' */
export const pathOnly = (href: string) => href.split(/[?#]/)[0] || '/';
