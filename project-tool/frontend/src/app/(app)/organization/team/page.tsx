"use client";

import { InviteForm } from "@/components/team/InviteForm";
import { MembersList } from "@/components/team/MembersList";
import { PendingInvitations } from "@/components/team/PendingInvitations";
import { Card, CardHeader, PageHeader } from "@/components/ui/PageHeader";
import { useCurrentOrg, useWorkspace } from "@/lib/workspace-context";

export default function TeamPage() {
  const org = useCurrentOrg();
  const { isOrgAdmin, spaces } = useWorkspace();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Team & Invites"
        description={isOrgAdmin ? `Invite people to ${org.name} and manage their roles.` : `People in ${org.name}.`}
      />
      {isOrgAdmin && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Invite someone" description="They'll get an email with a link to join." />
            <div className="p-5">
              <InviteForm orgId={org.id} spaces={spaces} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Pending invitations" description="Links expire automatically; resend to get a fresh one." />
            <div className="px-5 py-2">
              <PendingInvitations orgId={org.id} />
            </div>
          </Card>
        </div>
      )}
      <Card>
        <CardHeader title="Members" description="Organization roles decide what people can see and change." />
        <div className="p-5">
          <MembersList orgId={org.id} spaces={spaces} />
        </div>
      </Card>
    </div>
  );
}
