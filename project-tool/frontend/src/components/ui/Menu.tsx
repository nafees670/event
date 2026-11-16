"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/cn";

export interface MenuItem {
  key: string;
  label: ReactNode;
  onSelect: () => void;
  active?: boolean;
}

/**
 * Keyboard-accessible dropdown menu: Enter/Space/ArrowDown opens, arrows move,
 * Escape closes and returns focus to the trigger.
 */
export function Menu({
  trigger,
  items,
  label,
  align = "left",
  header,
}: {
  trigger: ReactNode;
  items: MenuItem[];
  label: string;
  align?: "left" | "right";
  header?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) (itemRefs.current.find((_, i) => items[i]?.active) ?? itemRefs.current[0])?.focus();
  }, [open, items]);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onMenuKeyDown = (event: React.KeyboardEvent) => {
    const index = itemRefs.current.findIndex((el) => el === document.activeElement);
    const move = (next: number) => itemRefs.current[(next + items.length) % items.length]?.focus();
    if (event.key === "ArrowDown") move(index + 1);
    else if (event.key === "ArrowUp") move(index - 1);
    else if (event.key === "Home") move(0);
    else if (event.key === "End") move(items.length - 1);
    else if (event.key === "Escape") close();
    else if (event.key === "Tab") setOpen(false);
    else return;
    if (event.key !== "Tab") event.preventDefault();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(
          "flex max-w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-fg transition-colors hover:bg-surface-2",
          open && "bg-surface-2",
        )}
      >
        {trigger}
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
          className={cn(
            "absolute z-40 mt-1.5 max-h-80 min-w-56 origin-top animate-scale-in overflow-auto rounded-xl border border-border bg-surface p-1 shadow-pop",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {header && <div className="mb-1 border-b border-border px-2.5 pt-1.5 pb-2.5 text-xs text-muted">{header}</div>}
          {items.map((item, i) => (
            <button
              key={item.key}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                item.onSelect();
                close();
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-fg hover:bg-surface-2 focus:bg-surface-2 focus:outline-none",
                item.active && "font-medium text-primary-soft-fg",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
