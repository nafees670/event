import type { UserSummary } from "@/lib/api/types";
import { cn } from "@/lib/cn";

const palette = [
  "from-indigo-500 to-violet-500",
  "from-emerald-500 to-teal-500",
  "from-amber-500 to-orange-500",
  "from-rose-500 to-pink-500",
  "from-sky-500 to-blue-500",
  "from-fuchsia-500 to-purple-500",
];

export function initials(name: string): string {
  const parts = name.trim().split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function Avatar({ user, size = "md" }: { user: Pick<UserSummary, "id" | "display_name" | "avatar">; size?: "sm" | "md" }) {
  const dimension = size === "sm" ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs";
  if (user.avatar) {
    // Uploads are served by Django under /media, so a plain img is used rather than next/image.
    return <img src={user.avatar} alt="" className={cn("rounded-full object-cover ring-2 ring-surface", dimension)} />;
  }
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white ring-2 ring-surface",
        palette[user.id % palette.length],
        dimension,
      )}
    >
      {initials(user.display_name)}
    </span>
  );
}

/** Overlapping avatars with the full names in a tooltip; collapses beyond ``max``. */
export function AvatarStack({ users, max = 3 }: { users: Pick<UserSummary, "id" | "display_name" | "avatar">[]; max?: number }) {
  if (users.length === 0) return null;
  const shown = users.slice(0, max);
  const rest = users.length - shown.length;
  const names = users.map((u) => u.display_name).join(", ");
  return (
    <span className="flex items-center -space-x-1.5" title={names} aria-label={`Assigned to ${names}`} role="img">
      {shown.map((user) => (
        <Avatar key={user.id} user={user} size="sm" />
      ))}
      {rest > 0 && (
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-surface-3 text-[10px] font-semibold text-muted ring-2 ring-surface">
          +{rest}
        </span>
      )}
    </span>
  );
}
