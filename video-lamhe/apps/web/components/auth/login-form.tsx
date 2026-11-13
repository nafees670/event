'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { loginSchema } from '@video-lamhe/shared';
import { Button, FormAlert, Input } from '@/components/ui';
import { login } from '@/lib/api/auth';
import { applyServerError } from '@/lib/forms';

type In = z.input<typeof loginSchema>;
type Out = z.output<typeof loginSchema>;

export function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<In, unknown, Out>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await login(values);
      onSuccess();
    } catch (err) {
      applyServerError(err, setError);
    }
  });

  return (
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
      <Input
        label="Password"
        type="password"
        autoComplete="current-password"
        error={errors.password?.message}
        {...register('password')}
      />
      <Link
        href="/forgot-password"
        className="-mt-1 w-fit text-sm text-gold-text underline-offset-4 hover:underline"
      >
        Forgot password?
      </Link>
      <Button type="submit" size="lg" loading={isSubmitting} className="mt-2">
        Log in
      </Button>
    </form>
  );
}
