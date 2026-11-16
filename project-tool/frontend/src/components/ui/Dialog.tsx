"use client";

import { X } from "lucide-react";
import { useId, useRef, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";

/** Accessible modal: focus is moved in and trapped, Escape closes, focus returns on close. */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg";
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useFocusTrap(panelRef, open, onClose);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div className="absolute inset-0 animate-fade-in bg-overlay backdrop-blur-[2px]" aria-hidden onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "relative flex max-h-[calc(100dvh-2rem)] w-full animate-scale-in flex-col rounded-xl border border-border bg-surface shadow-pop",
          size === "lg" ? "max-w-2xl" : "max-w-md",
        )}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 id={titleId} className="text-[15px] font-semibold text-fg">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-subtle transition-colors hover:bg-surface-2 hover:text-fg"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-3 text-sm text-muted">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 rounded-b-xl border-t border-border bg-surface-2/50 px-5 py-3">{footer}</div>
        )}
      </div>
    </div>
  );
}
