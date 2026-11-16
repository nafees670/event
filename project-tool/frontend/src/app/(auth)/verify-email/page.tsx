"use client";

import { zodResolver } from "@hookform/resolvers/zod";
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
import { errorMessage } from "@/lib/api/client";
import { applyApiErrors, emailSchema, safeNext } from "@/lib/forms";

const schema = z.object({
  email: emailSchema,
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code from the email."),
});
type FormValues = z.infer<typeof schema>;

function VerifyForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    getValues,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: params.get("email") ?? "", code: "" } });

  const onSubmit = async (values: FormValues) => {
    setFormError(null);
    try {
      await authApi.verifyEmail(values);
      router.push(`/login?verified=1&email=${encodeURIComponent(values.email)}&next=${encodeURIComponent(next)}`);
    } catch (error) {
      setFormError(applyApiErrors(error, setError, ["email", "code"]));
    }
  };

  const resend = async () => {
    if (!(await trigger("email"))) return;
    setResending(true);
    setFormError(null);
    try {
      setNotice((await authApi.resendVerification(getValues("email"))).detail);
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setResending(false);
    }
  };

  return (
    <>
      <AuthHeading title="Check your email" subtitle="We sent a 6-digit code to your inbox. It expires in 15 minutes." />
      <div className="space-y-3">
        {notice && <Alert tone="success">{notice}</Alert>}
        {formError && <Alert tone="error">{formError}</Alert>}
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4" noValidate>
        <TextField label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
        <TextField
          label="Verification code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          className="h-12 text-center font-mono text-xl tracking-[0.5em]"
          error={errors.code?.message}
          {...register("code")}
        />
        <Button type="submit" loading={isSubmitting} className="w-full">
          Verify
        </Button>
      </form>
      <Button variant="ghost" size="sm" loading={resending} onClick={() => void resend()} className="mt-3 w-full">
        Send a new code
      </Button>
    </>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <VerifyForm />
    </Suspense>
  );
}
