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
import { applyApiErrors, passwordSchema } from "@/lib/forms";

const schema = z
  .object({ new_password: passwordSchema, confirm: z.string() })
  .refine((v) => v.new_password === v.confirm, { path: ["confirm"], message: "Passwords don't match." });
type FormValues = z.infer<typeof schema>;

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const uid = params.get("uid");
  const token = params.get("token");
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { new_password: "", confirm: "" } });

  if (!uid || !token) {
    return (
      <Alert tone="error">
        This reset link is incomplete.{" "}
        <Link href="/forgot-password" className="underline">
          Request a new one
        </Link>
        .
      </Alert>
    );
  }

  const onSubmit = async ({ new_password }: FormValues) => {
    setFormError(null);
    try {
      await authApi.confirmPasswordReset({ uid, token, new_password });
      router.push("/login?reset=1");
    } catch (error) {
      setFormError(applyApiErrors(error, setError, ["new_password"]));
    }
  };

  return (
    <>
      <AuthHeading title="Choose a new password" />
      {formError && (
        <Alert tone="error" className="mb-4">
          {formError}{" "}
          <Link href="/forgot-password" className="underline">
            Request a new link
          </Link>
        </Alert>
      )}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          error={errors.new_password?.message}
          {...register("new_password")}
        />
        <TextField
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          error={errors.confirm?.message}
          {...register("confirm")}
        />
        <Button type="submit" loading={isSubmitting} className="w-full">
          Update password
        </Button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ResetForm />
    </Suspense>
  );
}
