"use client";

import { Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { Kbd } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { visibleNavItems } from "@/lib/navigation";
import { useWorkspace } from "@/lib/workspace-context";

import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

function SidebarContent({ onNavigate, onOpenPalette }: { onNavigate?: () => void; onOpenPalette: () => void }) {
  const pathname = usePathname();
  const { spaces, spaceSelection, setSpaceSelection, noSpaceAssigned, isOrgAdmin } = useWorkspace();
  const navItems = visibleNavItems(isOrgAdmin, spaces);
  // The longest matching item wins, so /projects/12 highlights Projects and
  // /organization/team highlights Team rather than Organization.
  const activeHref = navItems.map((item) => item.href)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-4 pb-3">
        <Logo />
      </div>
      <div className="px-3">
        <button
          type="button"
          onClick={onOpenPalette}
          className="flex h-8 w-full items-center gap-2 rounded-lg border border-border bg-surface-2/60 px-2.5 text-[13px] text-subtle transition-colors hover:border-border-strong hover:text-muted"
        >
          <Search className="h-3.5 w-3.5" aria-hidden />
          <span className="flex-1 text-left">Search…</span>
          <Kbd>Ctrl K</Kbd>
        </button>
      </div>

      <nav aria-label="Main" className="mt-4 flex-1 overflow-y-auto px-3">
        <ul className="space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = href === activeHref;
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                    active ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface-2/70 hover:text-fg",
                  )}
                >
                  <Icon
                    className={cn("h-4 w-4 transition-colors", active ? "text-primary" : "text-subtle group-hover:text-muted")}
                    aria-hidden
                  />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>

        {!noSpaceAssigned && spaces.length > 0 && (
          <div className="mt-6">
            <p className="px-2.5 text-[11px] font-medium tracking-wide text-subtle uppercase">Spaces</p>
            <ul className="mt-1.5 space-y-0.5">
              {spaces.map((space) => {
                const active = spaceSelection === space.id;
                return (
                  <li key={space.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSpaceSelection(space.id);
                        onNavigate?.();
                      }}
                      aria-pressed={active}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors",
                        active ? "bg-surface-2 font-medium text-fg" : "text-muted hover:bg-surface-2/70 hover:text-fg",
                      )}
                    >
                      <span
                        className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-[8px] font-bold text-white"
                        style={{ backgroundColor: space.color }}
                        aria-hidden
                      >
                        {space.short_code[0]}
                      </span>
                      <span className="truncate">{space.name}</span>
                      <span className="ml-auto font-mono text-[10px] text-subtle">{space.short_code}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </nav>

      <div className="border-t border-border p-3">
        <ThemeToggle />
      </div>
    </div>
  );
}

export function Sidebar({
  mobileOpen,
  onClose,
  onOpenPalette,
}: {
  mobileOpen: boolean;
  onClose: () => void;
  onOpenPalette: () => void;
}) {
  const pathname = usePathname();

  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen, onClose]);

  return (
    <>
      <aside className="hidden w-64 shrink-0 border-r border-border bg-surface lg:block">
        <SidebarContent onOpenPalette={onOpenPalette} />
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-overlay" aria-hidden onClick={onClose} />
          <aside className="relative h-full w-72 animate-slide-in-left bg-surface shadow-pop" aria-label="Navigation drawer">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close navigation"
              className="absolute top-3.5 right-3 rounded-md p-1 text-subtle hover:bg-surface-2 hover:text-fg"
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarContent onNavigate={onClose} onOpenPalette={onOpenPalette} />
          </aside>
        </div>
      )}
    </>
  );
}
