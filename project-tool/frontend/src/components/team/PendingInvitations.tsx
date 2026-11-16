"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/api/client";
import { orgsApi, queryKeys } from "@/lib/api/orgs";

import { CopyLink } from "./CopyLink";

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

export function PendingInvitations({ orgId }: { orgId: number }) {
  const queryClient = useQueryClient();
  const [resent, setResent] = useState<{ id: number; url: string } | null>(null);
  const toast = useToast();
  const query = useQuery({ queryKey: queryKeys.invitations(orgId), queryFn: () => orgsApi.invitations(orgId) });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.invitations(orgId) });

  const resend = useMutation({
    mutationFn: (id: number) => orgsApi.resendInvitation(orgId, id),
    onSuccess: (inv) => {
      setResent({ id: inv.id, url: inv.invite_url ?? "" });
      toast.success("Invitation resent", `A new link was emailed to ${inv.email}.`);
      void invalidate();
    },
    onError: (error) => toast.error("Couldn't resend", errorMessage(error)),
  });
  const revoke = useMutation({
    mutationFn: (id: number) => orgsApi.revokeInvitation(orgId, id),
    onSuccess: () => {
      toast.success("Invitation revoked");
      void invalidate();
    },
    onError: (error) => toast.error("Couldn't revoke", errorMessage(error)),
  });

  if (query.isPending) return <ListSkeleton rows={2} label="Loading invitations" />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  if (query.data.results.length === 0) {
    return <EmptyState icon={Mail} title="No pending invitations" description="Invitations you send appear here until they are accepted." />;
  }

  return (
    <div>
      <ul className="divide-y divide-border">
        {query.data.results.map((inv) => (
          <li key={inv.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-fg">{inv.email}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                <Badge>{inv.role}</Badge>
                {inv.space_name && (
                  <Badge tone="indigo">
                    {inv.space_name} · {inv.space_role}
                  </Badge>
                )}
                Expires {dateFormat.format(new Date(inv.expires_at))}
              </p>
              {resent?.id === inv.id && <CopyLink url={resent.url} />}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                loading={resend.isPending && resend.variables === inv.id}
                onClick={() => resend.mutate(inv.id)}
              >
                Resend
              </Button>
              <Button
                size="sm"
                variant="ghost"
                loading={revoke.isPending && revoke.variables === inv.id}
                onClick={() => revoke.mutate(inv.id)}
              >
                Revoke
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
