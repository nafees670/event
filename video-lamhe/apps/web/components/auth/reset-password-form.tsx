'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { passwordSchema } from '@video-lamhe/shared';
import { Button, Card, CardContent, FormAlert, Input } from '@/components/ui';
import { resetPassword } from '@/lib/api/auth';
import { applyServerError } from '@/lib/forms';

const formSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords don’t match' });
type Values = z.infer<typeof formSchema>;

export function ResetPasswordForm() {
  const token = useSearchParams().get('token');
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(formSchema) });

  if (!token) {
    return (
      <Card>
        <CardContent className="flex flex-col items-start gap-4 p-6 sm:p-8">
          <h1 className="text-4xl">Invalid link</h1>
          <p className="text-muted">This reset link is incomplete. Request a new one.</p>
          <Button asChild variant="outline">
            <Link href="/forgot-password">Request new link</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const onSubmit = handleSubmit(async ({ password }) => {
    try {
      await resetPassword({ token, password });
      toast.success('Password updated. Please log in.');
      router.replace('/login');
    } catch (err) {
      applyServerError(err, setError);
    }
  });

  return (
    <Card>
      <CardContent className="flex flex-col gap-6 p-6 sm:p-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl">Set a new password</h1>
          <p className="text-sm text-muted">You’ll be logged out of other devices.</p>
        </div>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {errors.root?.server && (
            <FormAlert>
              {errors.root.server.message}{' '}
              <Link href="/forgot-password" className="underline">
                Request a new link
              </Link>
            </FormAlert>
          )}
          <Input
            label="New password"
            type="password"
            autoComplete="new-password"
            hint="At least 8 characters."
            error={errors.password?.message}
            {...register('password')}
          />
          <Input
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            error={errors.confirm?.message}
            {...register('confirm')}
          />
          <Button type="submit" size="lg" loading={isSubmitting}>
            Update password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
