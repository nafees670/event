"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { SelectField } from "@/components/ui/Field";
import { errorMessage } from "@/lib/api/client";
import { orgsApi, queryKeys } from "@/lib/api/orgs";
import type { OrgMember, Space, SpaceRole } from "@/lib/api/types";

export function MemberSpacesDialog({
  orgId,
  member,
  spaces,
  onClose,
}: {
  orgId: number;
  member: OrgMember | null;
  spaces: Space[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [spaceId, setSpaceId] = useState("");
  const [role, setRole] = useState<SpaceRole>("EMPLOYEE");
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.members(orgId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.spaces(orgId) });
  };
  const add = useMutation({
    mutationFn: () => orgsApi.addSpaceMember(orgId, Number(spaceId), member!.user.id, role),
    onSuccess: () => {
      setSpaceId("");
      refresh();
    },
    onError: (e) => setError(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (args: { spaceId: number; membershipId: number }) =>
      orgsApi.removeSpaceMember(orgId, args.spaceId, args.membershipId),
    onSuccess: refresh,
    onError: (e) => setError(errorMessage(e)),
  });

  const available = spaces.filter((s) => !member?.spaces.some((ms) => ms.space_id === s.id));
  const isGuest = member?.role === "GUEST";

  return (
    <Dialog open={member !== null} onClose={onClose} title={`Spaces for ${member?.user.display_name ?? ""}`}>
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        {member && member.spaces.length === 0 && <p className="text-muted">Not in any space yet.</p>}
        <ul className="space-y-2">
          {member?.spaces.map((s) => (
            <li key={s.membership_id} className="flex items-center gap-2">
              <span className="flex-1 truncate text-fg">
                {s.name} <span className="text-xs text-subtle">{s.short_code}</span>
              </span>
              <Badge tone="emerald">{s.role}</Badge>
              <button
                type="button"
                aria-label={`Remove from ${s.name}`}
                onClick={() => {
                  setError(null);
                  remove.mutate({ spaceId: s.space_id, membershipId: s.membership_id });
                }}
                className="rounded-md p-1 text-subtle transition-colors hover:bg-surface-2 hover:text-red-500"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
        {available.length > 0 && (
          <form
            className="space-y-3 border-t border-border pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!spaceId) return;
              setError(null);
              add.mutate();
            }}
          >
            <SelectField label="Add to space" value={spaceId} onChange={(e) => setSpaceId(e.target.value)}>
              <option value="">Choose a space…</option>
              {available.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.short_code})
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Space role"
              value={isGuest ? "GUEST" : role}
              disabled={isGuest}
              hint={isGuest ? "Organization guests are always read-only guests in spaces." : undefined}
              onChange={(e) => setRole(e.target.value as SpaceRole)}
            >
              <option value="EMPLOYEE">Employee</option>
              <option value="MANAGER">Manager</option>
              <option value="GUEST">Guest (read only)</option>
            </SelectField>
            <Button type="submit" size="sm" loading={add.isPending} disabled={!spaceId}>
              Add
            </Button>
          </form>
        )}
      </div>
    </Dialog>
  );
}
