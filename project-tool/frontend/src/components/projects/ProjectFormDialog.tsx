"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { projectKeys, projectsApi, type ProjectPayload } from "@/lib/api/projects";
import type { Project, Space } from "@/lib/api/types";
import { applyApiErrors } from "@/lib/forms";
import { useParticipants } from "@/lib/hooks/useSpaceData";
import { PROJECT_STATUSES, suggestCode } from "@/lib/tasks";
import { useCurrentOrg } from "@/lib/workspace-context";

const url = z.union([z.literal(""), z.string().trim().url("Enter a full link, starting with https://")]);

const schema = z
  .object({
    space: z.string().min(1, "Pick a space."),
    name: z.string().trim().min(2, "Use at least 2 characters.").max(120),
    short_code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z][A-Z0-9]{1,9}$/, "2-10 letters or digits, starting with a letter."),
    description: z.string(),
    status: z.enum(["ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED"]),
    lead_id: z.string(),
    start_date: z.string(),
    target_date: z.string(),
    repo_url: url,
    docs_url: url,
    drive_url: url,
  })
  .refine((v) => !v.start_date || !v.target_date || v.target_date >= v.start_date, {
    path: ["target_date"],
    message: "The target date can't be before the start date.",
  });

type FormValues = z.infer<typeof schema>;
const FIELDS: (keyof FormValues)[] = [
  "space",
  "name",
  "short_code",
  "description",
  "status",
  "lead_id",
  "start_date",
  "target_date",
  "repo_url",
  "docs_url",
  "drive_url",
];

function toValues(project: Project | undefined, defaultSpace: number | undefined): FormValues {
  return {
    space: String(project?.space ?? defaultSpace ?? ""),
    name: project?.name ?? "",
    short_code: project?.short_code ?? "",
    description: project?.description ?? "",
    status: project?.status ?? "ACTIVE",
    lead_id: project?.lead ? String(project.lead.id) : "",
    start_date: project?.start_date ?? "",
    target_date: project?.target_date ?? "",
    repo_url: project?.repo_url ?? "",
    docs_url: project?.docs_url ?? "",
    drive_url: project?.drive_url ?? "",
  };
}

/** Create a project (``project`` omitted) or edit one. ``spaces`` are the spaces the user manages. */
export function ProjectFormDialog({
  open,
  onClose,
  project,
  spaces,
  defaultSpace,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  project?: Project;
  spaces: Space[];
  defaultSpace?: number;
  onSaved?: (project: Project) => void;
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
    formState: { errors, dirtyFields },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: toValues(project, defaultSpace) });

  useEffect(() => {
    if (open) reset(toValues(project, defaultSpace));
  }, [open, project, defaultSpace, reset]);

  const spaceId = Number(watch("space")) || undefined;
  const participants = useParticipants(spaceId);
  const name = watch("name");

  // Offer a code from the name until the user types their own.
  const codeTouched = !!dirtyFields.short_code;
  useEffect(() => {
    if (!project && !codeTouched) setValue("short_code", suggestCode(name));
  }, [name, project, codeTouched, setValue]);

  const save = useMutation({
    mutationFn: (values: FormValues) => {
      const payload: ProjectPayload = {
        name: values.name,
        short_code: values.short_code,
        description: values.description,
        status: values.status,
        lead_id: values.lead_id ? Number(values.lead_id) : null,
        start_date: values.start_date || null,
        target_date: values.target_date || null,
        repo_url: values.repo_url,
        docs_url: values.docs_url,
        drive_url: values.drive_url,
      };
      return project
        ? projectsApi.update(org.id, project.id, payload)
        : projectsApi.create(org.id, { ...payload, space: Number(values.space) });
    },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.all(org.id) });
      toast.success(project ? "Project updated" : `${saved.short_code} created`);
      onSaved?.(saved);
      onClose();
    },
    onError: (error) => {
      const message = applyApiErrors(error, setError, FIELDS);
      if (message) toast.error("Couldn't save the project", message);
    },
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={project ? `Edit ${project.short_code}` : "New project"}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" type="submit" form="project-form" loading={save.isPending}>
            {project ? "Save changes" : "Create project"}
          </Button>
        </>
      }
    >
      <form id="project-form" onSubmit={handleSubmit((v) => save.mutate(v))} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
          <TextField label="Name" data-autofocus error={errors.name?.message} {...register("name")} />
          <TextField
            label="Code"
            hint="Task ids: CODE-12"
            error={errors.short_code?.message}
            className="font-mono uppercase"
            {...register("short_code")}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Space" disabled={!!project} error={errors.space?.message} {...register("space")}>
            <option value="">Choose a space…</option>
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.short_code})
              </option>
            ))}
          </SelectField>
          <SelectField label="Lead" error={errors.lead_id?.message} {...register("lead_id")}>
            <option value="">No lead</option>
            {(participants.data ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.display_name}
              </option>
            ))}
          </SelectField>
        </div>
        <TextAreaField label="Description" rows={3} error={errors.description?.message} {...register("description")} />
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField label="Status" {...register("status")}>
            {PROJECT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </SelectField>
          <TextField label="Start date" type="date" error={errors.start_date?.message} {...register("start_date")} />
          <TextField label="Target date" type="date" error={errors.target_date?.message} {...register("target_date")} />
        </div>
        <fieldset className="space-y-3">
          <legend className="text-[13px] font-medium text-fg">Links</legend>
          <TextField label="Code repository" placeholder="https://github.com/…" error={errors.repo_url?.message} {...register("repo_url")} />
          <TextField label="Proposal / docs" placeholder="https://docs.google.com/…" error={errors.docs_url?.message} {...register("docs_url")} />
          <TextField label="Shared drive" placeholder="https://drive.google.com/…" error={errors.drive_url?.message} {...register("drive_url")} />
        </fieldset>
      </form>
    </Dialog>
  );
}
