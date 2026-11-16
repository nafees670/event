import { AlertTriangle, Loader2, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";

import { Button } from "./Button";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-shimmer rounded-md bg-surface-3", className)} />;
}

/** Placeholder rows shaped like a list of people/items. */
export function ListSkeleton({ rows = 4, label = "Loading…" }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="divide-y divide-border">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 py-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-7 w-20" />
        </div>
      ))}
    </div>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-muted">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      {label}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex animate-fade-in flex-col items-center gap-3 rounded-xl border border-red-200 bg-red-50/60 px-6 py-10 text-center dark:border-red-500/20 dark:bg-red-500/5"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400">
        <AlertTriangle className="h-5 w-5" aria-hidden />
      </span>
      <div>
        <p className="text-sm font-medium text-fg">Couldn&apos;t load this</p>
        <p className="mt-1 text-[13px] text-muted">{errorMessage(error)}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex animate-fade-in flex-col items-center gap-3 rounded-xl border border-dashed border-border-strong px-6 py-12 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-2 text-muted ring-1 ring-border">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div>
        <p className="text-sm font-medium text-fg">{title}</p>
        {description && <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
