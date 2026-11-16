"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { AuthFrame, AuthHeading } from "@/components/layout/AuthFrame";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { authApi } from "@/lib/api/auth";
import { errorMessage } from "@/lib/api/client";
import { orgsApi, queryKeys } from "@/lib/api/orgs";
import type { PublicInvitation, User } from "@/lib/api/types";
import { safeStorage } from "@/lib/storage";

const STATUS_TEXT: Record<string, string> = {
  ACCEPTED: "This invitation has already been accepted.",
  REVOKED: "This invitation was revoked. Ask an admin to send a new one.",
  EXPIRED: "This invitation has expired. Ask an admin to send a new one.",
};

function InviteActions({ token, invitation, user }: { token: string; invitation: PublicInvitation; user: User | null }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const accept = useMutation({
    mutationFn: () => orgsApi.acceptInvitation(token),
    onSuccess: (org) => {
      safeStorage.set("pm.currentOrg", String(org.id));
      void queryClient.invalidateQueries({ queryKey: queryKeys.orgs });
      router.replace("/dashboard");
    },
  });
  const here = `/invite/${token}`;
  const emailParam = encodeURIComponent(invitation.email);

  if (invitation.status !== "PENDING") return <Alert tone="info">{STATUS_TEXT[invitation.status]}</Alert>;

  if (!user) {
    return (
      <div className="space-y-2">
        <Link
          href={`/register?email=${emailParam}&next=${encodeURIComponent(here)}`}
          className="flex h-9 w-full items-center justify-center rounded-lg bg-primary text-sm font-medium text-primary-fg transition-colors hover:bg-primary-hover"
        >
          Create an account
        </Link>
        <Link
          href={`/login?email=${emailParam}&next=${encodeURIComponent(here)}`}
          className="flex h-9 w-full items-center justify-center rounded-lg border border-border bg-surface text-sm font-medium text-fg shadow-card transition-colors hover:bg-surface-2"
        >
          I already have an account
        </Link>
      </div>
    );
  }

  if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
    return (
      <div className="space-y-3">
        <Alert tone="error">
          You are signed in as <strong>{user.email}</strong>, but this invitation is for <strong>{invitation.email}</strong>.
        </Alert>
        <Button
          variant="secondary"
          className="w-full"
          onClick={async () => {
            await authApi.logout().catch(() => undefined);
            window.location.assign(`/login?email=${emailParam}&next=${encodeURIComponent(here)}`);
          }}
        >
          Sign in with a different account
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {accept.isError && <Alert tone="error">{errorMessage(accept.error)}</Alert>}
      <Button className="w-full" loading={accept.isPending} onClick={() => accept.mutate()}>
        Accept invitation
      </Button>
    </div>
  );
}

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const invitation = useQuery({ queryKey: ["invitation", token], queryFn: () => orgsApi.publicInvitation(token) });
  // The page is public: a 401 here just means "not signed in".
  const me = useQuery({
    // Separate key: a signed-out "null" must not leak into the app's own "me" cache.
    queryKey: ["invite-page-me"],
    queryFn: () => authApi.me({ redirectOnAuthFailure: false }).catch(() => null),
  });

  return (
    <AuthFrame>
      <div>
        {invitation.isPending || me.isPending ? (
          <LoadingState />
        ) : invitation.isError ? (
          <ErrorState error={invitation.error} />
        ) : (
          <div className="space-y-4">
            <AuthHeading
              title={`Join ${invitation.data.organization_name}`}
              subtitle={
                <>
                  {invitation.data.invited_by_name ?? "An admin"} invited <strong className="text-fg">{invitation.data.email}</strong> as{" "}
                  {invitation.data.role.toLowerCase()}
                  {invitation.data.space_name ? ` in the ${invitation.data.space_name} space` : ""}.
                </>
              }
            />
            <InviteActions token={token} invitation={invitation.data} user={me.data ?? null} />
          </div>
        )}
      </div>
    </AuthFrame>
  );
}
