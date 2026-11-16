"use client";

import { X } from "lucide-react";
import { useRef, type ReactNode } from "react";

import { useFocusTrap } from "@/lib/hooks/useFocusTrap";

/** Right-hand side panel with the same focus handling as Dialog. Full width on phones. */
export function Drawer({
  open,
  onClose,
  label,
  header,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  header?: ReactNode;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open, onClose);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 animate-fade-in bg-overlay" aria-hidden onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="absolute inset-y-0 right-0 flex w-full animate-slide-in-right flex-col border-l border-border bg-surface shadow-pop sm:w-[min(44rem,92vw)]"
      >
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
          <div className="flex min-w-0 flex-1 items-center gap-2">{header}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-subtle transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
