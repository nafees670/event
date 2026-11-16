"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
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
import { ApiError } from "@/lib/api/client";
import { applyApiErrors, emailSchema, safeNext } from "@/lib/forms";

const schema = z.object({ email: emailSchema, password: z.string().min(1, "Password is required.") });
type FormValues = z.infer<typeof schema>;

const REASONS: Record<string, string> = {
  idle: "You were signed out after a period of inactivity.",
  expired: "Your session has expired. Sign in again.",
};

function LoginForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: params.get("email") ?? "", password: "" } });

  const onSubmit = async (values: FormValues) => {
    setFormError(null);
    try {
      await authApi.login(values);
      // Drop anything cached for a previous (or signed-out) session.
      queryClient.clear();
      router.replace(next);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.code === "email_not_verified") {
        router.push(`/verify-email?email=${encodeURIComponent(values.email)}&next=${encodeURIComponent(next)}`);
        return;
      }
      setFormError(applyApiErrors(error, setError, ["email", "password"]));
    }
  };

  const reason = params.get("reason");
  return (
    <>
      <AuthHeading title="Welcome back" subtitle="Sign in to your workspace." />
      <div className="space-y-3">
        {reason && REASONS[reason] && <Alert tone="info">{REASONS[reason]}</Alert>}
        {params.get("verified") && <Alert tone="success">Email verified. You can sign in now.</Alert>}
        {params.get("reset") && <Alert tone="success">Password updated. Sign in with your new password.</Alert>}
        {formError && <Alert tone="error">{formError}</Alert>}
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4" noValidate>
        <TextField label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
        <div className="relative">
          <Link
            href="/forgot-password"
            className="absolute top-0 right-0 text-[13px] font-medium text-primary hover:underline"
          >
            Forgot password?
          </Link>
          <TextField
            label="Password"
            type="password"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register("password")}
          />
        </div>
        <Button type="submit" loading={isSubmitting} className="w-full">
          Sign in
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        New here?{" "}
        <Link href={`/register?next=${encodeURIComponent(next)}`} className="font-medium text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <LoginForm />
    </Suspense>
  );
}
