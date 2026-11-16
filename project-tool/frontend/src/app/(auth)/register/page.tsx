"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { AuthHeading } from "@/components/layout/AuthFrame";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { LoadingState } from "@/components/ui/States";
import { authApi } from "@/lib/api/auth";
import { applyApiErrors, emailSchema, passwordSchema, safeNext } from "@/lib/forms";

const schema = z
  .object({
    full_name: z.string().trim().max(150),
    email: emailSchema,
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match." });
type FormValues = z.infer<typeof schema>;

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { full_name: "", email: params.get("email") ?? "", password: "", confirm: "" },
  });

  const onSubmit = async ({ full_name, email, password }: FormValues) => {
    setFormError(null);
    try {
      await authApi.register({ full_name, email, password });
      router.push(`/verify-email?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`);
    } catch (error) {
      const message = applyApiErrors(error, setError, ["email", "full_name", "password"]);
      // Password validators report under non_field_errors.
      setFormError(message);
    }
  };

  return (
    <>
      <AuthHeading title="Create your account" subtitle="Start organizing your team's work in minutes." />
      {formError && (
        <Alert tone="error" className="mb-4">
          {formError}
        </Alert>
      )}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <TextField label="Full name" autoComplete="name" error={errors.full_name?.message} {...register("full_name")} />
        <TextField label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters; avoid common passwords."
          error={errors.password?.message}
          {...register("password")}
        />
        <TextField
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          error={errors.confirm?.message}
          {...register("confirm")}
        />
        <Button type="submit" loading={isSubmitting} className="w-full">
          Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <RegisterForm />
    </Suspense>
  );
}
