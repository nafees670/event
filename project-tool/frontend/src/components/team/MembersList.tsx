"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { useState } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { controlClass } from "@/components/ui/Field";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/api/client";
import { orgsApi, queryKeys } from "@/lib/api/orgs";
import type { OrgMember, OrgRole, Space } from "@/lib/api/types";
import { useWorkspace } from "@/lib/workspace-context";

import { MemberSpacesDialog } from "./MemberSpacesDialog";

export function MembersList({ orgId, spaces }: { orgId: number; spaces: Space[] }) {
  const queryClient = useQueryClient();
  const { isOrgAdmin, user } = useWorkspace();
  const [search, setSearch] = useState("");
  const toast = useToast();
  const [toRemove, setToRemove] = useState<OrgMember | null>(null);
  const [managingId, setManagingId] = useState<number | null>(null);

  const query = useQuery({ queryKey: queryKeys.members(orgId), queryFn: () => orgsApi.members(orgId) });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.members(orgId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.orgs });
  };

  const changeRole = useMutation({
    mutationFn: (args: { id: number; role: OrgRole }) => orgsApi.updateMemberRole(orgId, args.id, args.role),
    onSuccess: (member) => {
      toast.success("Role updated", `${member.user.display_name} is now ${member.role.toLowerCase()}.`);
      refresh();
    },
    onError: (error) => toast.error("Couldn't change role", errorMessage(error)),
  });
  const remove = useMutation({
    mutationFn: (id: number) => orgsApi.removeMember(orgId, id),
    onSuccess: () => {
      toast.success("Member removed");
      setToRemove(null);
      refresh();
    },
    onError: (error) => {
      setToRemove(null);
      toast.error("Couldn't remove member", errorMessage(error));
    },
  });

  if (query.isPending) return <ListSkeleton label="Loading members" />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  const term = search.trim().toLowerCase();
  const members = query.data.results.filter(
    (m) => !term || m.user.email.toLowerCase().includes(term) || m.user.display_name.toLowerCase().includes(term),
  );
  // Read the member from fresh query data so the dialog reflects changes immediately.
  const managing = query.data.results.find((m) => m.id === managingId) ?? null;

  return (
    <div className="space-y-3">
 <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search members…"
        aria-label="Search members"
        className={`${controlClass} h-9 border-border sm:max-w-xs`}
      />
      {members.length === 0 ? (
        <EmptyState icon={Users} title={term ? "No members match your search" : "No members yet"} />
      ) : (
        <ul className="divide-y divide-border">
          {members.map((member) => {
            const isSelf = member.user.id === user?.id;
            return (
              <li key={member.id} className="flex flex-col gap-3 py-3.5 md:flex-row md:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar user={member.user} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-fg">
                      {member.user.display_name} {isSelf && <span className="text-xs text-subtle">(you)</span>}
                    </p>
                    <p className="truncate text-xs text-muted">{member.user.email}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 md:w-56">
                  {member.spaces.length === 0 ? (
                    <Badge tone="amber">No space</Badge>
                  ) : (
                    member.spaces.map((s) => (
                      <Badge key={s.membership_id} title={`${s.name}: ${s.role}`}>
                        {s.short_code} · {s.role.toLowerCase()}
                      </Badge>
                    ))
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isOrgAdmin ? (
                    <select
                      aria-label={`Role for ${member.user.display_name}`}
                      value={member.role}
                      disabled={changeRole.isPending}
                      onChange={(e) => {
                        changeRole.mutate({ id: member.id, role: e.target.value as OrgRole });
                      }}
                      className={`${controlClass} h-8 w-auto border-border py-0 pr-7 text-[13px]`}
                    >
                      <option value="ADMIN">Admin</option>
                      <option value="MEMBER">Member</option>
                      <option value="GUEST">Guest</option>
                    </select>
                  ) : (
                    <Badge tone="indigo">{member.role}</Badge>
                  )}
                  {isOrgAdmin && (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => setManagingId(member.id)}>
                        Spaces
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setToRemove(member)}>
                        Remove
                      </Button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog
        open={toRemove !== null}
        onClose={() => setToRemove(null)}
        title="Remove member?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setToRemove(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={remove.isPending}
              onClick={() => {
                if (toRemove) remove.mutate(toRemove.id);
              }}
            >
              Remove
            </Button>
          </>
        }
      >
        <strong>{toRemove?.user.display_name}</strong> will lose access to this organization and all of its spaces.
      </Dialog>

      <MemberSpacesDialog orgId={orgId} member={managing} spaces={spaces} onClose={() => setManagingId(null)} />
    </div>
  );
}
