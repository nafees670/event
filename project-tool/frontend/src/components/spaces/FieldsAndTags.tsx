"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Pencil, Plus, SlidersHorizontal, Tags, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { TagPill } from "@/components/tasks/bits";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dialog } from "@/components/ui/Dialog";
import { ColorField, SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { ApiError, errorMessage } from "@/lib/api/client";
import { spaceKeys, spacesApi } from "@/lib/api/spaces";
import { taskKeys } from "@/lib/api/tasks";
import type { CustomField, FieldType, Space, Tag } from "@/lib/api/types";
import { useSpaceFields, useSpaceTags } from "@/lib/hooks/useSpaceData";
import { FIELD_TYPES, SWATCHES } from "@/lib/tasks";
import { useCurrentOrg } from "@/lib/workspace-context";

function FieldDialog({ open, onClose, space, field }: { open: boolean; onClose: () => void; space: Space; field?: CustomField }) {
  const org = useCurrentOrg();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState("");
  const [type, setType] = useState<FieldType>("text");
  const [options, setOptions] = useState("");
  const [required, setRequired] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setName(field?.name ?? "");
    setType(field?.field_type ?? "text");
    setOptions(field?.options.join("\n") ?? "");
    setRequired(field?.required ?? false);
    setErrors({});
  }, [open, field]);

  const save = useMutation({
    mutationFn: () => {
      const data = { name: name.trim(), options: options.split("\n").map((o) => o.trim()).filter(Boolean), required };
      return field
        ? spacesApi.updateField(org.id, space.id, field.id, data)
        : spacesApi.createField(org.id, space.id, { ...data, field_type: type });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: spaceKeys.fields(org.id, space.id) });
      toast.success(field ? "Field updated" : "Field added");
      onClose();
    },
    onError: (err) => {
      if (err instanceof ApiError && (err.fieldError("name") || err.fieldError("options"))) {
        setErrors({ name: err.fieldError("name") ?? "", options: err.fieldError("options") ?? "" });
      } else toast.error("Couldn't save the field", errorMessage(err));
    },
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={field ? `Edit “${field.name}”` : "New custom field"}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" type="submit" form="field-form" loading={save.isPending}>
            Save
          </Button>
        </>
      }
    >
      <form
        id="field-form"
        className="space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) setErrors({ name: "Enter a name." });
          else save.mutate();
        }}
      >
        <TextField label="Name" data-autofocus value={name} onChange={(e) => setName(e.target.value)} error={errors.name || undefined} />
        <SelectField
          label="Type"
          value={type}
          disabled={!!field}
          hint={field ? "The type can't change once tasks may have values." : undefined}
          onChange={(e) => setType(e.target.value as FieldType)}
        >
          {FIELD_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </SelectField>
        {type === "select" && (
          <TextAreaField
            label="Options"
            hint="One per line."
            rows={4}
            value={options}
            onChange={(e) => setOptions(e.target.value)}
            error={errors.options || undefined}
          />
        )}
        <label className="flex items-center gap-2 text-[13px] text-fg">
          <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
          Required on every task
        </label>
      </form>
    </Dialog>
  );
}

export function FieldsEditor({ space, canEdit }: { space: Space; canEdit: boolean }) {
  const org = useCurrentOrg();
  const queryClient = useQueryClient();
  const toast = useToast();
  const fields = useSpaceFields(space.id);
  const [editing, setEditing] = useState<CustomField | "new" | null>(null);
  const [deleting, setDeleting] = useState<CustomField | null>(null);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: spaceKeys.fields(org.id, space.id) });

  const reorder = useMutation({
    mutationFn: (ids: number[]) => spacesApi.reorderFields(org.id, space.id, ids),
    onSuccess: refresh,
    onError: (err) => toast.error("Couldn't reorder", errorMessage(err)),
  });
  const remove = useMutation({
    mutationFn: (id: number) => spacesApi.deleteField(org.id, space.id, id),
    onSuccess: () => {
      setDeleting(null);
      refresh();
      toast.success("Field deleted");
    },
    onError: (err) => toast.error("Couldn't delete the field", errorMessage(err)),
  });

  if (fields.isPending) return <ListSkeleton rows={3} label="Loading fields" />;
  if (fields.isError) return <ErrorState error={fields.error} onRetry={() => void fields.refetch()} />;
  const list = fields.data;
  const move = (index: number, delta: number) => {
    const ids = list.map((f) => f.id);
    const [id] = ids.splice(index, 1);
    ids.splice(index + delta, 0, id!);
    reorder.mutate(ids);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-[13px] text-muted">Extra details every task in {space.name} can carry, shown in the task panel.</p>
        {canEdit && (
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" aria-hidden /> Add field
          </Button>
        )}
      </div>
      {list.length === 0 ? (
        <EmptyState icon={SlidersHorizontal} title="No custom fields" description="Add fields such as story points, budget or client." />
      ) : (
        <ol className="divide-y divide-border rounded-xl border border-border bg-surface">
          {list.map((field, i) => (
            <li key={field.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="text-[13px] font-medium text-fg">{field.name}</span>
                {field.field_type === "select" && <span className="ml-2 text-xs text-muted">{field.options.join(" · ")}</span>}
              </span>
              {field.required && <Badge tone="amber">Required</Badge>}
              <Badge>{FIELD_TYPES.find((t) => t.value === field.field_type)?.label}</Badge>
              {canEdit && (
                <span className="flex gap-0.5">
                  <Button variant="ghost" size="icon" aria-label={`Move ${field.name} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Move ${field.name} down`}
                    disabled={i === list.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label={`Edit ${field.name}`} onClick={() => setEditing(field)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label={`Delete ${field.name}`} onClick={() => setDeleting(field)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
      <FieldDialog open={editing !== null} onClose={() => setEditing(null)} space={space} field={editing === "new" ? undefined : (editing ?? undefined)} />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        loading={remove.isPending}
        title={`Delete “${deleting?.name}”?`}
      >
        Values already filled in on tasks are no longer shown.
      </ConfirmDialog>
    </div>
  );
}

export function TagsEditor({ space, canEdit, canCreate }: { space: Space; canEdit: boolean; canCreate: boolean }) {
  const org = useCurrentOrg();
  const queryClient = useQueryClient();
  const toast = useToast();
  const tags = useSpaceTags(space.id);
  const [editing, setEditing] = useState<Tag | "new" | null>(null);
  const [deleting, setDeleting] = useState<Tag | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(SWATCHES[0]!);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (editing === null) return;
    setName(editing === "new" ? "" : editing.name);
    setColor(editing === "new" ? SWATCHES[0]! : editing.color);
    setError(undefined);
  }, [editing]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: spaceKeys.tags(org.id, space.id) });
    void queryClient.invalidateQueries({ queryKey: taskKeys.all(org.id) });
  };
  const save = useMutation({
    mutationFn: () =>
      editing && editing !== "new"
        ? spacesApi.updateTag(org.id, space.id, editing.id, { name: name.trim(), color })
        : spacesApi.createTag(org.id, space.id, { name: name.trim(), color }),
    onSuccess: () => {
      refresh();
      setEditing(null);
    },
    onError: (err) => {
      const field = err instanceof ApiError ? err.fieldError("name") : undefined;
      if (field) setError(field);
      else toast.error("Couldn't save the tag", errorMessage(err));
    },
  });
  const remove = useMutation({
    mutationFn: (id: number) => spacesApi.deleteTag(org.id, space.id, id),
    onSuccess: () => {
      setDeleting(null);
      refresh();
    },
    onError: (err) => toast.error("Couldn't delete the tag", errorMessage(err)),
  });

  if (tags.isPending) return <ListSkeleton rows={3} label="Loading tags" />;
  if (tags.isError) return <ErrorState error={tags.error} onRetry={() => void tags.refetch()} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-[13px] text-muted">Labels for tasks in {space.name}, such as #Security or #SEO.</p>
        {canCreate && (
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" aria-hidden /> Add tag
          </Button>
        )}
      </div>
      {tags.data.length === 0 ? (
        <EmptyState icon={Tags} title="No tags yet" />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {tags.data.map((tag) => (
            <li key={tag.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="flex-1">
                <TagPill tag={tag} />
              </span>
              {canEdit && (
                <span className="flex gap-0.5">
                  <Button variant="ghost" size="icon" aria-label={`Edit ${tag.name}`} onClick={() => setEditing(tag)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label={`Delete ${tag.name}`} onClick={() => setDeleting(tag)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing && editing !== "new" ? `Edit #${editing.name}` : "New tag"}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button size="sm" type="submit" form="tag-form" loading={save.isPending}>
              Save
            </Button>
          </>
        }
      >
        <form
          id="tag-form"
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) setError("Enter a name.");
            else save.mutate();
          }}
        >
          <TextField label="Name" data-autofocus value={name} onChange={(e) => setName(e.target.value)} error={error} />
          <ColorField label="Color" value={color} onChange={setColor} colors={SWATCHES} />
        </form>
      </Dialog>
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        loading={remove.isPending}
        title={`Delete #${deleting?.name}?`}
      >
        The tag is removed from every task that has it.
      </ConfirmDialog>
    </div>
  );
}
