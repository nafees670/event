"use client";

import { Plus, Settings2, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/PageHeader";
import { usePermissions } from "@/lib/hooks/useSpaceData";
import { useWorkspace } from "@/lib/workspace-context";

import { DEPARTMENTS, SpaceFormDialog } from "./SpaceFormDialog";

/** The organization's spaces, with links to each space's workflow and fields. */
export function SpacesCard() {
  const { spaces, isOrgAdmin, noSpaceAssigned } = useWorkspace();
  const { canManage } = usePermissions();
  const [creating, setCreating] = useState(false);

  return (
    <Card className="mt-6">
      <CardHeader
        title="Spaces"
        description="Each department works in its own space, with its own workflow and fields."
        actions={
          isOrgAdmin && (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" aria-hidden /> New space
            </Button>
          )
        }
      />
      {noSpaceAssigned ? (
        <p className="px-5 py-4 text-[13px] text-muted">You are not assigned to a space yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {spaces.map((space) => (
            <li key={space.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white"
                style={{ backgroundColor: space.color }}
                aria-hidden
              >
                {space.short_code.slice(0, 2)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-fg">{space.name}</p>
                <p className="flex items-center gap-2 text-xs text-muted">
                  <span className="font-mono">{space.short_code}</span>
                  <span>{DEPARTMENTS.find((d) => d.value === space.department_type)?.label}</span>
                  <span className="flex items-center gap-0.5">
                    <Users className="h-3 w-3" aria-hidden /> {space.member_count}
                  </span>
                </p>
              </div>
              {space.my_role && <Badge tone="emerald">{space.my_role.toLowerCase()}</Badge>}
              <Link
                href={`/organization/spaces/${space.id}`}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-[13px] font-medium text-fg shadow-card transition-colors hover:bg-surface-2"
              >
                <Settings2 className="h-3.5 w-3.5" aria-hidden />
                {canManage(space) ? "Workflow & fields" : "View workflow"}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <SpaceFormDialog open={creating} onClose={() => setCreating(false)} />
    </Card>
  );
}
