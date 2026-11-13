'use client';

import type { ReactNode } from 'react';
import type { Role } from '@video-lamhe/shared';
import { RequireAuth } from '@/components/auth/require-auth';
import { Badge, Card, CardContent } from '@/components/ui';
import { useAuthStore } from '@/stores/auth';
import { DashboardHeader } from './dashboard-header';

interface Props {
  roles?: Role[];
  label: string;
  comingIn: string;
  /** Extra sections below the profile card. */
  children?: ReactNode;
}

/** Temporary dashboard shell until each dashboard is built (Phases 2–7). */
export function DashboardPlaceholder({ roles, label, comingIn, children }: Props) {
  return (
    <RequireAuth roles={roles}>
      <DashboardHeader label={label} />
      <DashboardBody label={label} comingIn={comingIn}>
        {children}
      </DashboardBody>
    </RequireAuth>
  );
}

function DashboardBody({ label, comingIn, children }: Omit<Props, 'roles'>) {
  const user = useAuthStore((s) => s.user)!;
  const phone = `0${user.phone.slice(2, 5)} ${user.phone.slice(5)}`;
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
      <h1 className="text-5xl">
        Salaam, <em className="accent">{user.name.split(' ')[0]}</em>
      </h1>
      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl">Profile</h2>
            <Badge variant="gold" className="capitalize">
              {user.role}
            </Badge>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted">Name</dt>
            <dd>{user.name}</dd>
            <dt className="text-muted">Email</dt>
            <dd className="break-all">{user.email}</dd>
            <dt className="text-muted">Mobile</dt>
            <dd>{phone}</dd>
          </dl>
        </CardContent>
      </Card>
      {children}
      <p className="text-sm text-muted">
        {label} features arrive in {comingIn}.
      </p>
    </main>
  );
}
