"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Card } from "@/components/ui/PageHeader";
import { orgsApi, queryKeys } from "@/lib/api/orgs";
import type { Organization } from "@/lib/api/types";
import { applyApiErrors } from "@/lib/forms";
import { useWorkspace } from "@/lib/workspace-context";

const schema = z.object({ name: z.string().trim().min(2, "Use at least 2 characters.").max(120) });
type FormValues = z.infer<typeof schema>;

export default function OnboardingPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { orgs, setCurrentOrgId } = useWorkspace();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: "" } });

  const create = useMutation({
    mutationFn: (values: FormValues) => orgsApi.create(values.name),
    onSuccess: (org) => {
      queryClient.setQueryData<Organization[]>(queryKeys.orgs, (old) => [...(old ?? []), org]);
      setCurrentOrgId(org.id);
      router.replace("/dashboard");
    },
    onError: (error) => setFormError(applyApiErrors(error, setError, ["name"])),
  });

  return (
    <Card className="animate-slide-up p-6 sm:p-8">
      <h1 className="text-xl font-semibold tracking-tight text-fg">{orgs.length ? "Create another organization" : "Create your organization"}</h1>
      <p className="mt-1 text-sm text-muted">
        You&apos;ll be its admin. A <strong>General</strong> space is created for you; you can invite your team next.
      </p>
      {orgs.length === 0 && (
        <Alert tone="info" className="mt-4">
          Waiting for an invitation instead? Open the link from your invite email to join an existing organization.
        </Alert>
      )}
      {formError && (
        <Alert tone="error" className="mt-4">
          {formError}
        </Alert>
      )}
      <form
        onSubmit={handleSubmit((values) => {
          setFormError(null);
          create.mutate(values);
        })}
        className="mt-4 space-y-4"
        noValidate
      >
        <TextField label="Organization name" placeholder="Acme Inc." error={errors.name?.message} {...register("name")} />
        <div className="flex gap-2">
          <Button type="submit" loading={create.isPending}>
            Create organization
          </Button>
          {orgs.length > 0 && (
            <Button variant="secondary" onClick={() => router.back()}>
              Cancel
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
