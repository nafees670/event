import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginScreen } from '@/components/auth/login-screen';
import { Skeleton } from '@/components/ui';

export const metadata: Metadata = { title: 'Log in', robots: { index: false } };

export default function LoginPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[560px] w-full rounded-card" />}>
      <LoginScreen />
    </Suspense>
  );
}
