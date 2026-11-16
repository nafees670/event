"use client";

import { useRef } from "react";

import { cn } from "@/lib/cn";

export interface TabItem<T extends string> {
  value: T;
  label: string;
  count?: number;
}

/** Tab list with roving focus (arrow keys). The caller renders the panel for ``value``. */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  idPrefix = "tabs",
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  /** Keeps ids unique when two tab sets are on screen (a page and a drawer). */
  idPrefix?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = (index + delta + items.length) % items.length;
    refs.current[next]?.focus();
    onChange(items[next]!.value);
  };

  return (
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-border">
      {items.map((item, i) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${item.value}`}
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${item.value}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.value)}
            onKeyDown={(event) => onKeyDown(event, i)}
            className={cn(
              "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] font-medium transition-colors",
              selected ? "border-primary text-fg" : "border-transparent text-muted hover:text-fg",
            )}
          >
            {item.label}
            {item.count !== undefined && (
              <span className="rounded-full bg-surface-2 px-1.5 text-[11px] text-muted">{item.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel<T extends string>({
  value,
  children,
  idPrefix = "tabs",
}: {
  value: T;
  children: React.ReactNode;
  idPrefix?: string;
}) {
  return (
    <div
      role="tabpanel"
      id={`${idPrefix}-panel-${value}`}
      aria-labelledby={`${idPrefix}-tab-${value}`}
      className="animate-fade-in pt-6"
    >
      {children}
    </div>
  );
}
