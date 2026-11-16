"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { SpacesCard } from "@/components/spaces/SpacesCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Card, CardHeader, PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { orgsApi, queryKeys } from "@/lib/api/orgs";
import type { Organization } from "@/lib/api/types";
import { applyApiErrors } from "@/lib/forms";
import { useCurrentOrg, useWorkspace } from "@/lib/workspace-context";

const schema = z.object({ name: z.string().trim().min(2, "Use at least 2 characters.").max(120) });
type FormValues = z.infer<typeof schema>;

export default function OrganizationPage() {
  const org = useCurrentOrg();
  const { isOrgAdmin } = useWorkspace();
  const queryClient = useQueryClient();
  const toast = useToast();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: org.name } });

  useEffect(() => reset({ name: org.name }), [org.id, org.name, reset]);

  const save = useMutation({
    mutationFn: (values: FormValues) => orgsApi.update(org.id, values),
    onSuccess: (updated) => {
      queryClient.setQueryData<Organization[]>(queryKeys.orgs, (old) => old?.map((o) => (o.id === updated.id ? updated : o)));
      toast.success("Organization updated");
    },
    onError: (error) => {
      const text = applyApiErrors(error, setError, ["name"]);
      if (text) toast.error("Couldn't save", text);
    },
  });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Organization" description="Settings for your organization." />
      <Card className="mb-6 p-5">
        <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted">Your role</dt>
            <dd className="mt-1">
              <Badge tone="indigo">{org.my_role}</Badge>
            </dd>
          </div>
          <div>
            <dt className="text-muted">Members</dt>
            <dd className="mt-1 font-medium text-fg">{org.member_count}</dd>
          </div>
          <div>
            <dt className="text-muted">Slug</dt>
            <dd className="mt-1 font-mono text-xs text-fg">{org.slug}</dd>
          </div>
        </dl>
      </Card>
      <Card>
        <CardHeader title="General" description="The organization name is shown to everyone in it." />
        <form
          onSubmit={handleSubmit((values) => save.mutate(values))}
          className="space-y-4 p-5"
          noValidate
        >
          <TextField
            label="Name"
            disabled={!isOrgAdmin}
            hint={isOrgAdmin ? undefined : "Only organization admins can change this."}
            error={errors.name?.message}
            {...register("name")}
          />
          {isOrgAdmin && (
            <Button type="submit" loading={save.isPending} disabled={!isDirty}>
              Save changes
            </Button>
          )}
        </form>
      </Card>
      <SpacesCard />
    </div>
  );
}
