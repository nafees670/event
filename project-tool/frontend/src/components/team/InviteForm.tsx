"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { SelectField, TextField } from "@/components/ui/Field";
import { orgsApi, queryKeys } from "@/lib/api/orgs";
import type { Space } from "@/lib/api/types";
import { applyApiErrors, emailSchema } from "@/lib/forms";

import { CopyLink } from "./CopyLink";

const schema = z.object({
  email: emailSchema,
  role: z.enum(["ADMIN", "MEMBER", "GUEST"]),
  space: z.string(),
  space_role: z.enum(["MANAGER", "EMPLOYEE", "GUEST"]),
});
type FormValues = z.infer<typeof schema>;

export function InviteForm({ orgId, spaces }: { orgId: number; spaces: Space[] }) {
  const queryClient = useQueryClient();
  const [result, setResult] = useState<{ email: string; url: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", role: "MEMBER", space: "", space_role: "EMPLOYEE" },
  });
  const role = watch("role");
  const space = watch("space");

  const invite = useMutation({
    mutationFn: (values: FormValues) =>
      orgsApi.invite(orgId, {
        email: values.email,
        role: values.role,
        space: values.space ? Number(values.space) : null,
        space_role: values.space ? values.space_role : "",
      }),
    onSuccess: (invitation) => {
      setResult({ email: invitation.email, url: invitation.invite_url ?? "" });
      reset({ email: "", role: "MEMBER", space: "", space_role: "EMPLOYEE" });
      void queryClient.invalidateQueries({ queryKey: queryKeys.invitations(orgId) });
    },
    onError: (error) => setFormError(applyApiErrors(error, setError, ["email", "role", "space", "space_role"])),
  });

  return (
    <div className="space-y-4">
      {result && (
        <Alert tone="success">
          Invitation emailed to <strong>{result.email}</strong>. You can also share this link (shown only once):
          <CopyLink url={result.url} />
        </Alert>
      )}
      {formError && <Alert tone="error">{formError}</Alert>}
      <form
        onSubmit={handleSubmit((values) => {
          setFormError(null);
          setResult(null);
          invite.mutate(values);
        })}
        className="grid gap-4 sm:grid-cols-2"
        noValidate
      >
        <div className="sm:col-span-2">
          <TextField label="Email" type="email" placeholder="teammate@company.com" error={errors.email?.message} {...register("email")} />
        </div>
        <SelectField label="Organization role" error={errors.role?.message} {...register("role")}>
          <option value="MEMBER">Member</option>
          <option value="ADMIN">Admin</option>
          <option value="GUEST">Guest (read only)</option>
        </SelectField>
        <SelectField label="Add to space (optional)" error={errors.space?.message} {...register("space")}>
          <option value="">No space yet</option>
          {spaces.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.short_code})
            </option>
          ))}
        </SelectField>
        {space && role !== "GUEST" && (
          <SelectField label="Space role" error={errors.space_role?.message} {...register("space_role")}>
            <option value="EMPLOYEE">Employee</option>
            <option value="MANAGER">Manager</option>
            <option value="GUEST">Guest (read only)</option>
          </SelectField>
        )}
        <div className="flex items-end sm:col-span-2">
          <Button type="submit" loading={invite.isPending}>
            Send invitation
          </Button>
        </div>
      </form>
    </div>
  );
}
