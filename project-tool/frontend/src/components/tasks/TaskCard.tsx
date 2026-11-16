"use client";

import { MessageSquare, Paperclip } from "lucide-react";
import type { HTMLAttributes, Ref } from "react";

import { AvatarStack } from "@/components/ui/Avatar";
import type { Task } from "@/lib/api/types";
import { cn } from "@/lib/cn";

import { DueDate, PriorityIcon, StateDot, TagPill } from "./bits";

export function TaskCard({
  task,
  onOpen,
  dragging,
  overlay,
  showState,
  className,
  ref,
  ...rest
}: {
  ref?: Ref<HTMLDivElement>;
  task: Task;
  onOpen?: () => void;
  dragging?: boolean;
  overlay?: boolean;
  /** On the cross-space board a column mixes states, so the card shows its own. */
  showState?: boolean;
} & HTMLAttributes<HTMLDivElement>) {
  const done = task.state.category === "COMPLETED" || task.state.category === "CANCELLED";
  return (
    <div
      ref={ref}
      {...rest}
      className={cn(
        "group relative rounded-lg border border-border bg-surface p-3 text-left shadow-card transition-[box-shadow,border-color,opacity]",
        task.can_edit ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        "hover:border-border-strong hover:shadow-pop",
        dragging && "opacity-40",
        overlay && "rotate-[1.5deg] cursor-grabbing border-primary/40 shadow-pop",
        className,
      )}
    >
      <div className="flex items-center gap-1.5 text-[11px]">
        <span className="font-mono font-medium text-subtle">{task.key}</span>
        {showState && (
          <span className="flex min-w-0 items-center gap-1 text-muted">
            <StateDot color={task.state.color} className="h-2 w-2" />
            <span className="truncate">{task.state.name}</span>
          </span>
        )}
        <span className="ml-auto">
          <PriorityIcon priority={task.priority} />
        </span>
      </div>
      <button
        type="button"
        onClick={onOpen}
        // dnd-kit listens for pointer events on the card; a click without movement still opens it.
        className={cn(
          "mt-1.5 block w-full text-left text-[13px] leading-snug font-medium text-fg focus:outline-none",
          "after:absolute after:inset-0 focus-visible:underline",
          done && "text-muted line-through decoration-subtle",
        )}
      >
        {task.title}
      </button>
      {task.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.tags.slice(0, 3).map((tag) => (
            <TagPill key={tag.id} tag={tag} />
          ))}
          {task.tags.length > 3 && <span className="text-[11px] text-subtle">+{task.tags.length - 3}</span>}
        </div>
      )}
      <div className="mt-2.5 flex items-center gap-2.5">
        <span className="rounded bg-surface-2 px-1.5 py-px font-mono text-[10px] font-semibold text-muted">
          {task.project.short_code}
        </span>
        {task.due_date && <DueDate due={task.due_date} done={done} />}
        {task.comment_count > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[11px] text-subtle" title={`${task.comment_count} comments`}>
            <MessageSquare className="h-3 w-3" aria-hidden />
            {task.comment_count}
          </span>
        )}
        {task.attachment_count > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[11px] text-subtle" title={`${task.attachment_count} files`}>
            <Paperclip className="h-3 w-3" aria-hidden />
            {task.attachment_count}
          </span>
        )}
        <span className="ml-auto">
          <AvatarStack users={task.assignees} />
        </span>
      </div>
    </div>
  );
}
