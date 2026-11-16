import { Layers } from "lucide-react";

import { EmptyState } from "@/components/ui/States";

export function NoSpaceNotice() {
  return (
    <EmptyState
      icon={Layers}
      title="You are not assigned to a space yet"
      description="Spaces hold your team's projects and tasks. Ask an organization admin to add you to one."
    />
  );
}
