"use client";

import { Check, Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/cn";

export interface PickerOption {
  value: number;
  label: string;
  /** Rendered before the label (avatar, colour dot…). */
  prefix?: ReactNode;
}

/**
 * Searchable multi-select popover (assignees, tags). Arrow keys move, Enter/Space toggles,
 * Escape closes and returns focus to the trigger.
 */
export function Picker({
  options,
  selected,
  onChange,
  trigger,
  label,
  disabled,
  onCreate,
  createLabel = "Create",
}: {
  options: PickerOption[];
  selected: number[];
  onChange: (values: number[]) => void;
  trigger: ReactNode;
  label: string;
  disabled?: boolean;
  /** When set, typing a name that doesn't exist offers to create it. */
  onCreate?: (name: string) => void;
  createLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);
  const canCreate =
    onCreate !== undefined && query.trim() !== "" && !options.some((o) => o.label.toLowerCase() === query.trim().toLowerCase());

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => setActive(0), [query]);

  const toggle = (value: number) =>
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);

  const close = () => {
    setOpen(false);
    setQuery("");
    triggerRef.current?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const count = filtered.length + (canCreate ? 1 : 0);
    if (event.key === "ArrowDown") setActive((i) => (i + 1) % Math.max(count, 1));
    else if (event.key === "ArrowUp") setActive((i) => (i - 1 + count) % Math.max(count, 1));
    else if (event.key === "Enter") {
      const option = filtered[active];
      if (option) toggle(option.value);
      else if (canCreate) {
        onCreate?.(query.trim());
        setQuery("");
      }
    } else if (event.key === "Escape") close();
    else return;
    event.preventDefault();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-8 w-full flex-wrap items-center gap-1 rounded-lg px-2 py-1 text-left text-[13px] text-fg transition-colors hover:bg-surface-2 disabled:cursor-default disabled:hover:bg-transparent"
      >
        {trigger}
      </button>
      {open && (
        <div
          className="absolute z-50 mt-1 w-64 animate-scale-in overflow-hidden rounded-xl border border-border bg-surface shadow-pop"
          onKeyDown={onKeyDown}
        >
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="h-3.5 w-3.5 text-subtle" aria-hidden />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              aria-label={`Search ${label.toLowerCase()}`}
              aria-controls={listId}
              aria-activedescendant={filtered[active] ? `${listId}-${filtered[active]!.value}` : undefined}
              className="h-9 flex-1 bg-transparent text-[13px] text-fg placeholder:text-subtle focus:outline-none"
            />
          </div>
          <ul id={listId} role="listbox" aria-multiselectable="true" aria-label={label} className="max-h-60 overflow-y-auto p-1">
            {filtered.map((option, i) => {
              const isSelected = selected.includes(option.value);
              return (
                <li
                  key={option.value}
                  id={`${listId}-${option.value}`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => toggle(option.value)}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-fg",
                    i === active && "bg-surface-2",
                  )}
                >
                  {option.prefix}
                  <span className="flex-1 truncate">{option.label}</span>
                  {isSelected && <Check className="h-3.5 w-3.5 text-primary" aria-hidden />}
                </li>
              );
            })}
            {canCreate && (
              <li
                role="option"
                aria-selected={false}
                onMouseEnter={() => setActive(filtered.length)}
                onClick={() => {
                  onCreate?.(query.trim());
                  setQuery("");
                }}
                className={cn(
                  "cursor-pointer rounded-lg px-2 py-1.5 text-[13px] text-primary-soft-fg",
                  active === filtered.length && "bg-surface-2",
                )}
              >
                {createLabel} “{query.trim()}”
              </li>
            )}
            {filtered.length === 0 && !canCreate && <li className="px-2 py-3 text-center text-[13px] text-muted">No matches</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
