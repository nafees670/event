import type { Role } from '@video-lamhe/shared';

export const DASHBOARD_HREF: Record<Role, string> = {
  customer: '/account',
  operator: '/operator',
  admin: '/admin',
};
