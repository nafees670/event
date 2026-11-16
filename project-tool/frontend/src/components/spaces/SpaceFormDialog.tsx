"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { ColorField, SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { queryKeys } from "@/lib/api/orgs";
import { spacesApi } from "@/lib/api/spaces";
import type { DepartmentType, Space } from "@/lib/api/types";
import { applyApiErrors } from "@/lib/forms";
import { SWATCHES, suggestCode } from "@/lib/tasks";
import { useCurrentOrg } from "@/lib/workspace-context";

export const DEPARTMENTS: { value: DepartmentType; label: string; workflow: string }[] = [
  { value: "ENGINEERING", label: "Engineering", workflow: "Backlog → To Do → In Progress → In Review → Completed; story points, component" },
  { value: "MARKETING", label: "Marketing", workflow: "Backlog → Planned → In Progress → In Review → Published; channel, budget" },
  { value: "SALES", label: "Sales", workflow: "Backlog → Prospecting → Negotiation → Proposal Review → Won / Lost; client, deal value" },
  { value: "OPERATIONS", label: "Operations", workflow: "Backlog → To Do → In Progress → Awaiting Vendor → Done; vendor, cost" },
  { value: "HR", label: "HR", workflow: "Backlog → To Do → In Progress → In Review → Completed; employee, stage" },
  { value: "GENERAL", label: "General", workflow: "Backlog → To Do → In Progress → In Review → Completed" },
];

const schema = z.object({
  name: z.string().trim().min(2, "Use at least 2 characters.").max(100),
  short_code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z][A-Z0-9]{1,9}$/, "2-10 letters or digits, starting with a letter."),
  department_type: z.enum(["ENGINEERING", "MARKETING", "SALES", "OPERATIONS", "HR", "GENERAL"]),
  color: z.string(),
  description: z.string(),
});
type FormValues = z.infer<typeof schema>;

function toValues(space: Space | undefined): FormValues {
  return {
    name: space?.name ?? "",
    short_code: space?.short_code ?? "",
    department_type: space?.department_type ?? "ENGINEERING",
    color: space?.color ?? SWATCHES[0]!,
    description: space?.description ?? "",
  };
}

/** Create a space (org admins) or edit one (admins and the space's managers). */
export function SpaceFormDialog({
  open,
  onClose,
  space,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  space?: Space;
  onSaved?: (space: Space) => void;
}) {
  const org = useCurrentOrg();
  const queryClient = useQueryClient();
  const toast = useToast();
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    setError,
    control,
    formState: { errors, dirtyFields },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: toValues(space) });

  useEffect(() => {
    if (open) reset(toValues(space));
  }, [open, space, reset]);

  const name = watch("name");
  const department = watch("department_type");
  const codeTouched = !!dirtyFields.short_code;
  useEffect(() => {
    if (!space && !codeTouched) setValue("short_code", suggestCode(name).slice(0, 4));
  }, [name, space, codeTouched, setValue]);

  const save = useMutation({
    mutationFn: (values: FormValues) =>
      space
        ? spacesApi.update(org.id, space.id, {
            name: values.name,
            short_code: values.short_code,
            color: values.color,
            description: values.description,
          })
        : spacesApi.create(org.id, values),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.spaces(org.id) });
      toast.success(space ? "Space updated" : `${saved.name} created`);
      onSaved?.(saved);
      onClose();
    },
    onError: (error) => {
      const message = applyApiErrors(error, setError, ["name", "short_code", "color", "description"]);
      if (message) toast.error("Couldn't save the space", message);
    },
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={space ? `Edit ${space.name}` : "New space"}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" type="submit" form="space-form" loading={save.isPending}>
            {space ? "Save changes" : "Create space"}
          </Button>
        </>
      }
    >
      <form id="space-form" onSubmit={handleSubmit((v) => save.mutate(v))} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
          <TextField label="Name" data-autofocus placeholder="Software Engineering" error={errors.name?.message} {...register("name")} />
          <TextField label="Code" className="font-mono uppercase" error={errors.short_code?.message} {...register("short_code")} />
        </div>
        {!space && (
          <SelectField
            label="Department type"
            hint={DEPARTMENTS.find((d) => d.value === department)?.workflow}
            {...register("department_type")}
          >
            {DEPARTMENTS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </SelectField>
        )}
        <Controller
          control={control}
          name="color"
          render={({ field }) => <ColorField label="Color" value={field.value} onChange={field.onChange} colors={SWATCHES} />}
        />
        <TextAreaField label="Description" rows={2} {...register("description")} />
      </form>
    </Dialog>
  );
}
