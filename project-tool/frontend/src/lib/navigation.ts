import { Building2, ChartColumn, FolderKanban, LayoutDashboard, SquareKanban, Users, type LucideIcon } from "lucide-react";

import type { Space } from "@/lib/api/types";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown only to org admins and people who manage at least one space. */
  managersOnly?: boolean;
}

/** Only pages that exist are listed; later phases add theirs here. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tasks", label: "Task Board", icon: SquareKanban },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/analytics", label: "Analytics", icon: ChartColumn, managersOnly: true },
  { href: "/organization", label: "Organization", icon: Building2 },
  { href: "/organization/team", label: "Team & Invites", icon: Users },
];

export function visibleNavItems(isOrgAdmin: boolean, spaces: Space[]): NavItem[] {
  const manages = isOrgAdmin || spaces.some((s) => s.my_role === "MANAGER");
  return NAV_ITEMS.filter((item) => !item.managersOnly || manages);
}
