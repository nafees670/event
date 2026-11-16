import { CalendarClock } from "lucide-react";

import type { Priority, Tag } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { dueStatus, formatDay, priorityMeta } from "@/lib/tasks";

export function PriorityIcon({ priority, className }: { priority: Priority; className?: string }) {
  const meta = priorityMeta(priority);
  const Icon = meta.icon;
  return (
    <span title={meta.label} className="inline-flex">
      <Icon className={cn("h-3.5 w-3.5", meta.className, className)} aria-hidden />
      <span className="sr-only">Priority: {meta.label}</span>
    </span>
  );
}

export function StateDot({ color, className }: { color: string; className?: string }) {
  return <span aria-hidden className={cn("inline-block h-2.5 w-2.5 shrink-0 rounded-full", className)} style={{ backgroundColor: color }} />;
}

export function TagPill({ tag }: { tag: Pick<Tag, "name" | "color"> }) {
  return (
    <span
      className="inline-flex max-w-[9rem] items-center truncate rounded-md px-1.5 py-px text-[11px] font-medium"
      style={{ backgroundColor: `${tag.color}1f`, color: tag.color }}
    >
      #{tag.name}
    </span>
  );
}

const dueTone = {
  overdue: "text-red-600 dark:text-red-400",
  today: "text-amber-600 dark:text-amber-400",
  soon: "text-amber-600 dark:text-amber-400",
  later: "text-muted",
};

export function DueDate({ due, done }: { due: string; done: boolean }) {
  const status = dueStatus(due, done);
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px]", status ? dueTone[status] : "text-subtle")}>
      <CalendarClock className="h-3 w-3" aria-hidden />
      {status === "overdue" && <span className="sr-only">Overdue:</span>}
      {formatDay(due)}
    </span>
  );
}
