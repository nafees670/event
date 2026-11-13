'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormProvider, useForm } from 'react-hook-form';
import type { z } from 'zod';
import { operatorRegisterSchema } from '@video-lamhe/shared';
import { Button, Card, CardContent, FormAlert, Input, Skeleton } from '@/components/ui';
import { fetchCities, queryKeys, registerOperator } from '@/lib/api/catalog-client';
import { applyServerError } from '@/lib/forms';
import { OperatorProfileFields } from './profile-fields';

type In = z.input<typeof operatorRegisterSchema>;
type Out = z.output<typeof operatorRegisterSchema>;

export function OperatorRegisterForm() {
  const router = useRouter();
  const cities = useQuery({ queryKey: queryKeys.cities, queryFn: fetchCities });
  const form = useForm<In, unknown, Out>({
    resolver: zodResolver(operatorRegisterSchema),
    defaultValues: { serviceCities: [], experienceYears: 0 },
  });
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = form;

  const onSubmit = handleSubmit(async (values) => {
    try {
      await registerOperator(values);
      router.replace('/operator');
    } catch (err) {
      applyServerError(err, setError, { EMAIL_TAKEN: 'email', INVALID_REFERENCE: 'baseCity' });
    }
  });

  return (
    <Card>
      <CardContent className="flex flex-col gap-6 p-6 sm:p-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl leading-tight">
            Join as an <em className="accent">operator</em>
          </h1>
          <p className="text-sm text-muted">
            Create your account and business profile. Our team reviews every operator before they
            appear on Video Lamhe.
          </p>
        </div>

        <FormProvider {...form}>
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
            <FormAlert>{errors.root?.server?.message}</FormAlert>
            <fieldset className="flex flex-col gap-4">
              <legend className="mb-3 font-serif text-2xl">Your account</legend>
              <Input
                label="Your full name"
                autoComplete="name"
                error={errors.name?.message}
                {...register('name')}
              />
              <Input
                label="Email"
                type="email"
                inputMode="email"
                autoComplete="email"
                error={errors.email?.message}
                {...register('email')}
              />
              <Input
                label="Password"
                type="password"
                autoComplete="new-password"
                hint="At least 8 characters."
                error={errors.password?.message}
                {...register('password')}
              />
            </fieldset>

            <fieldset className="flex flex-col gap-4">
              <legend className="mb-3 font-serif text-2xl">Your business</legend>
              {cities.data ? (
                <OperatorProfileFields cities={cities.data} showSocial={false} showPhoto={false} />
              ) : cities.isError ? (
                <FormAlert>Couldn’t load cities. Refresh the page to try again.</FormAlert>
              ) : (
                <Skeleton className="h-64 w-full" />
              )}
            </fieldset>

            <Button type="submit" size="lg" loading={isSubmitting} disabled={!cities.data}>
              Submit for review
            </Button>
            <p className="text-center text-sm text-muted">
              Already have an account?{' '}
              <Link href="/login" className="text-gold-text underline-offset-4 hover:underline">
                Log in
              </Link>
            </p>
          </form>
        </FormProvider>
      </CardContent>
    </Card>
  );
}
