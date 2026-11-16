"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { DEPARTMENTS, SpaceFormDialog } from "@/components/spaces/SpaceFormDialog";
import { FieldsEditor, TagsEditor } from "@/components/spaces/FieldsAndTags";
import { WorkflowEditor } from "@/components/spaces/WorkflowEditor";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState, LoadingState } from "@/components/ui/States";
import { TabPanel, Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/orgs";
import { spacesApi } from "@/lib/api/spaces";
import { usePermissions } from "@/lib/hooks/useSpaceData";
import { useCurrentOrg, useWorkspace } from "@/lib/workspace-context";

type Tab = "workflow" | "fields" | "tags";
const TABS: Tab[] = ["workflow", "fields", "tags"];

function SpaceSettings() {
  const org = useCurrentOrg();
  const { spaces, isOrgAdmin } = useWorkspace();
  const { canManage, canContribute } = usePermissions();
  const queryClient = useQueryClient();
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { id } = useParams<{ id: string }>();
  const space = spaces.find((s) => s.id === Number(id));
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const tab: Tab = TABS.includes(params.get("tab") as Tab) ? (params.get("tab") as Tab) : "workflow";
  const remove = useMutation({
    mutationFn: () => spacesApi.remove(org.id, Number(id)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.spaces(org.id) });
      toast.success("Space deleted");
      router.push("/organization");
    },
    onError: (error) => toast.error("Couldn't delete the space", errorMessage(error)),
  });

  if (!space) {
    return (
      <div className="mx-auto max-w-lg pt-10">
        <EmptyState icon={ArrowLeft} title="Space not found" description="It may have been deleted, or you're not a member of it." />
      </div>
    );
  }
  const editable = canManage(space);

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/organization" className="mb-4 inline-flex items-center gap-1 text-[13px] text-muted hover:text-fg">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Organization
      </Link>
      <div className="mb-6 flex animate-slide-up flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm"
            style={{ backgroundColor: space.color }}
            aria-hidden
          >
            {space.short_code.slice(0, 2)}
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-fg">{space.name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
              <span className="font-mono text-xs">{space.short_code}</span>
              <Badge>{DEPARTMENTS.find((d) => d.value === space.department_type)?.label}</Badge>
              {space.description && <span>{space.description}</span>}
            </p>
          </div>
        </div>
        {editable && (
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
            </Button>
            {isOrgAdmin && (
              <Button variant="secondary" size="icon" aria-label="Delete space" onClick={() => setDeleting(true)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>

      {!editable && (
        <Alert tone="info" className="mb-4">
          Only organization admins and managers of this space can change its workflow and fields.
        </Alert>
      )}

      <Tabs
        idPrefix="space"
        label="Space settings"
        value={tab}
        onChange={(value) => router.replace(`${pathname}${value === "workflow" ? "" : `?tab=${value}`}`, { scroll: false })}
        items={[
          { value: "workflow", label: "Workflow" },
          { value: "fields", label: "Custom fields" },
          { value: "tags", label: "Tags" },
        ]}
      />
      <TabPanel idPrefix="space" value={tab}>
        {tab === "workflow" && <WorkflowEditor space={space} canEdit={editable} />}
        {tab === "fields" && <FieldsEditor space={space} canEdit={editable} />}
        {tab === "tags" && <TagsEditor space={space} canEdit={editable} canCreate={canContribute(space)} />}
      </TabPanel>

      <SpaceFormDialog open={editing} onClose={() => setEditing(false)} space={space} />
      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={() => remove.mutate()}
        loading={remove.isPending}
        title={`Delete ${space.name}?`}
      >
        Every project, task, comment and file in this space will be deleted. This can&apos;t be undone.
      </ConfirmDialog>
    </div>
  );
}

export default function SpaceSettingsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <SpaceSettings />
    </Suspense>
  );
}
