"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { AuthHeading } from "@/components/layout/AuthFrame";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { authApi } from "@/lib/api/auth";
import { applyApiErrors, emailSchema } from "@/lib/forms";

const schema = z.object({ email: emailSchema });
type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: "" } });

  const onSubmit = async ({ email }: FormValues) => {
    setFormError(null);
    try {
      setSent((await authApi.requestPasswordReset(email)).detail);
    } catch (error) {
      setFormError(applyApiErrors(error, setError, ["email"]));
    }
  };

  return (
    <>
      <AuthHeading title="Reset your password" subtitle="We'll email you a link to choose a new one." />
      {sent ? (
        <Alert tone="success">
          {sent}
        </Alert>
      ) : (
        <>
          {formError && (
            <Alert tone="error" className="mb-4">
              {formError}
            </Alert>
          )}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <TextField label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
            <Button type="submit" loading={isSubmitting} className="w-full">
              Send reset link
            </Button>
          </form>
        </>
      )}
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
