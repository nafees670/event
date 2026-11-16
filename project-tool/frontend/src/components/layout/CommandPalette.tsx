"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Building2, Layers, LogOut, Monitor, Moon, Plus, Search, Sun, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { Kbd } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { visibleNavItems } from "@/lib/navigation";
import { signOut } from "@/lib/session";
import { useTheme } from "@/lib/theme";
import { useWorkspace } from "@/lib/workspace-context";

interface Command {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  run: () => void;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { setPreference } = useTheme();
  const { orgs, currentOrg, setCurrentOrgId, spaces, isOrgAdmin, setSpaceSelection } = useWorkspace();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const commands = useMemo<Command[]>(() => {
    const go = (href: string) => () => router.push(href);
    return [
      ...visibleNavItems(isOrgAdmin, spaces).map((item) => ({ id: `nav-${item.href}`, group: "Go to", label: item.label, icon: item.icon, run: go(item.href) })),
      { id: "new-org", group: "Go to", label: "Create organization", icon: Plus, run: go("/onboarding") },
      ...orgs
        .filter((org) => org.id !== currentOrg?.id)
        .map((org) => ({
          id: `org-${org.id}`,
          group: "Switch organization",
          label: org.name,
          icon: Building2,
          run: () => setCurrentOrgId(org.id),
        })),
      ...(isOrgAdmin
        ? [{ id: "space-all", group: "Switch space", label: "All Spaces", icon: Layers, run: () => setSpaceSelection("all") }]
        : []),
      ...spaces.map((space) => ({
        id: `space-${space.id}`,
        group: "Switch space",
        label: space.name,
        hint: space.short_code,
        icon: Layers,
        run: () => setSpaceSelection(space.id),
      })),
      { id: "theme-light", group: "Theme", label: "Light theme", icon: Sun, run: () => setPreference("light") },
      { id: "theme-dark", group: "Theme", label: "Dark theme", icon: Moon, run: () => setPreference("dark") },
      { id: "theme-system", group: "Theme", label: "System theme", icon: Monitor, run: () => setPreference("system") },
      { id: "sign-out", group: "Account", label: "Sign out", icon: LogOut, run: () => void signOut(queryClient) },
    ];
  }, [router, orgs, currentOrg, setCurrentOrgId, isOrgAdmin, spaces, setSpaceSelection, setPreference, queryClient]);

  const term = query.trim().toLowerCase();
  const results = term
    ? commands.filter((c) => `${c.label} ${c.group} ${c.hint ?? ""}`.toLowerCase().includes(term))
    : commands;

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    const previouslyFocused = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    return () => previouslyFocused?.focus();
  }, [open]);

  useEffect(() => setActiveIndex(0), [term]);

  useEffect(() => {
    document.getElementById(`${listId}-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, listId]);

  if (!open) return null;

  const runAt = (index: number) => {
    const command = results[index];
    if (!command) return;
    onClose();
    command.run();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    else if (event.key === "ArrowUp") setActiveIndex((i) => Math.max(i - 1, 0));
    else if (event.key === "Enter") runAt(activeIndex);
    else if (event.key === "Escape") onClose();
    else return;
    event.preventDefault();
  };

  let lastGroup = "";
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]">
      <div className="absolute inset-0 animate-fade-in bg-overlay backdrop-blur-[2px]" aria-hidden onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative w-full max-w-lg animate-scale-in overflow-hidden rounded-xl border border-border bg-surface shadow-pop"
      >
        <div className="flex items-center gap-2.5 border-b border-border px-4">
          <Search className="h-4 w-4 text-subtle" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type a command or search…"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={results.length ? `${listId}-${activeIndex}` : undefined}
            className="h-12 flex-1 bg-transparent text-sm text-fg placeholder:text-subtle focus:outline-none"
          />
          <Kbd>Esc</Kbd>
        </div>
        <ul id={listId} role="listbox" className="max-h-80 overflow-y-auto p-1.5">
          {results.length === 0 && <li className="px-3 py-8 text-center text-sm text-muted">No results for “{query}”</li>}
          {results.map((command, index) => {
            const showGroup = command.group !== lastGroup;
            lastGroup = command.group;
            const Icon = command.icon;
            return (
              <li key={command.id} role="presentation">
                {showGroup && <p className="px-2.5 pt-2.5 pb-1 text-[11px] font-medium tracking-wide text-subtle uppercase">{command.group}</p>}
                <div
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  onMouseMove={() => setActiveIndex(index)}
                  onClick={() => runAt(index)}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm",
                    index === activeIndex ? "bg-surface-2 text-fg" : "text-muted",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  <span className="flex-1 truncate">{command.label}</span>
                  {command.hint && <span className="text-xs text-subtle">{command.hint}</span>}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center gap-3 border-t border-border bg-surface-2/50 px-4 py-2 text-[11px] text-subtle">
          <span className="flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> navigate
          </span>
          <span className="flex items-center gap-1">
            <Kbd>↵</Kbd> select
          </span>
        </div>
      </div>
    </div>
  );
}
