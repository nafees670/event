'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { MailCheck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { forgotPasswordSchema } from '@video-lamhe/shared';
import { Button, Card, CardContent, FormAlert, Input } from '@/components/ui';
import { forgotPassword } from '@/lib/api/auth';
import { applyServerError } from '@/lib/forms';

type In = z.input<typeof forgotPasswordSchema>;
type Out = z.output<typeof forgotPasswordSchema>;

export function ForgotPasswordForm() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<In, unknown, Out>({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await forgotPassword(values);
      setSentTo(values.email);
    } catch (err) {
      applyServerError(err, setError);
    }
  });

  return (
    <Card>
      <CardContent className="flex flex-col gap-6 p-6 sm:p-8">
        {sentTo ? (
          <div className="flex flex-col items-start gap-4" role="status">
            <MailCheck className="size-10 text-gold-text" aria-hidden="true" />
            <h1 className="text-4xl">Check your email</h1>
            <p className="text-muted">
              If an account exists for <span className="font-medium text-ink">{sentTo}</span>, we’ve
              sent a link to reset your password. It’s valid for 30 minutes.
            </p>
            <Button asChild variant="outline">
              <Link href="/login">Back to log in</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <h1 className="text-4xl">Forgot password?</h1>
              <p className="text-sm text-muted">
                Enter your email and we’ll send you a reset link.
              </p>
            </div>
            <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
              <FormAlert>{errors.root?.server?.message}</FormAlert>
              <Input
                label="Email"
                type="email"
                autoComplete="email"
                inputMode="email"
                error={errors.email?.message}
                {...register('email')}
              />
              <Button type="submit" size="lg" loading={isSubmitting}>
                Send reset link
              </Button>
              <Link
                href="/login"
                className="text-center text-sm text-gold-text underline-offset-4 hover:underline"
              >
                Back to log in
              </Link>
            </form>
          </>
        )}
      </CardContent>
    </Card>
  );
}
