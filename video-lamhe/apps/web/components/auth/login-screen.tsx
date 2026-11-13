'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card, CardContent, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';
import { clearPendingAction, loadPendingAction } from '@/lib/contact/pending';
import { pathOnly, sanitizeReturnTo } from '@/lib/contact/return-to';
import { useAuthStore } from '@/stores/auth';
import { loginHeading } from './login-copy';
import { LoginForm } from './login-form';
import { RegisterForm } from './register-form';

type Mode = 'login' | 'register';

const AUTH_PATHS = ['/login', '/forgot-password', '/reset-password'];

/**
 * Login + quick register on one screen (Section 2.1). Reads ?returnTo, ?action, ?target;
 * after success goes back to returnTo where PendingActionRunner resumes the action.
 */
export function LoginScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const status = useAuthStore((s) => s.status);

  let returnTo = sanitizeReturnTo(params.get('returnTo'));
  if (AUTH_PATHS.includes(pathOnly(returnTo))) returnTo = '/';
  const action = params.get('action');
  const target = params.get('target');

  const [mode, setMode] = useState<Mode>(params.get('mode') === 'register' ? 'register' : 'login');
  const [operatorName, setOperatorName] = useState<string>();

  // The saved action belongs to this login only if the URL says so. Otherwise it is left over
  // from an abandoned attempt and must not fire after this login (e.g. header "Log in").
  // A match also gives us the operator name for "Log in to WhatsApp [Operator name]".
  useEffect(() => {
    const pending = loadPendingAction();
    if (!pending) return;
    const matches =
      pending.action === action &&
      (pending.context?.operatorSlug ?? null) === target &&
      pending.returnTo === returnTo;
    if (matches) setOperatorName(pending.context?.operatorName);
    else clearPendingAction();
  }, [action, target, returnTo]);

  // Already logged in (e.g. back button) → straight back.
  useEffect(() => {
    if (status === 'authenticated') router.replace(returnTo);
  }, [status, router, returnTo]);

  const heading = loginHeading(action, operatorName);
  const done = () => router.replace(returnTo);

  return (
    <Card className="overflow-hidden">
      <CardContent className="flex flex-col gap-6 p-6 sm:p-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl leading-tight">
            {heading ?? (mode === 'login' ? 'Welcome back' : 'Create your account')}
          </h1>
          <p className="text-sm text-muted">
            {heading
              ? 'Browsing is free — we just need to know who’s getting in touch.'
              : 'Book verified drone operators across Pakistan.'}
          </p>
        </div>

        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <TabsList aria-label="Log in or create account" className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Log in</TabsTrigger>
            <TabsTrigger value="register">Create account</TabsTrigger>
          </TabsList>
          <TabsContent value="login">
            <LoginForm onSuccess={done} />
          </TabsContent>
          <TabsContent value="register">
            <RegisterForm onSuccess={done} />
          </TabsContent>
        </Tabs>
        <p className="text-center text-sm text-muted">
          Drone operator?{' '}
          <Link
            href="/register/operator"
            className="font-medium text-gold-text underline-offset-4 hover:underline"
          >
            Join as operator
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
