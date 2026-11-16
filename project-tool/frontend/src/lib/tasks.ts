import {
  Circle,
  CircleCheck,
  CircleDashed,
  CircleDot,
  CircleEllipsis,
  CircleX,
  Minus,
  OctagonAlert,
  SignalHigh,
  SignalLow,
  SignalMedium,
  type LucideIcon,
} from "lucide-react";

import type { FieldType, Priority, ProjectStatus, StateCategory } from "@/lib/api/types";

export const PRIORITIES: { value: Priority; label: string; icon: LucideIcon; className: string }[] = [
  { value: "URGENT", label: "Urgent", icon: OctagonAlert, className: "text-red-500" },
  { value: "HIGH", label: "High", icon: SignalHigh, className: "text-orange-500" },
  { value: "MEDIUM", label: "Medium", icon: SignalMedium, className: "text-amber-500" },
  { value: "LOW", label: "Low", icon: SignalLow, className: "text-sky-500" },
  { value: "NONE", label: "No priority", icon: Minus, className: "text-subtle" },
];

export const priorityMeta = (value: Priority) => PRIORITIES.find((p) => p.value === value) ?? PRIORITIES[4]!;

/** Board order for the cross-space ("All Spaces") view, which groups by category. */
export const CATEGORIES: { value: StateCategory; label: string; color: string; icon: LucideIcon }[] = [
  { value: "BACKLOG", label: "Backlog", color: "#94A3B8", icon: CircleDashed },
  { value: "UNSTARTED", label: "To Do", color: "#60A5FA", icon: Circle },
  { value: "STARTED", label: "In Progress", color: "#F59E0B", icon: CircleDot },
  { value: "REVIEW", label: "In Review", color: "#A855F7", icon: CircleEllipsis },
  { value: "COMPLETED", label: "Completed", color: "#10B981", icon: CircleCheck },
  { value: "CANCELLED", label: "Cancelled", color: "#64748B", icon: CircleX },
];

export const categoryMeta = (value: StateCategory) => CATEGORIES.find((c) => c.value === value) ?? CATEGORIES[0]!;

export const PROJECT_STATUSES: { value: ProjectStatus; label: string; tone: "emerald" | "amber" | "indigo" | "slate" }[] = [
  { value: "ACTIVE", label: "Active", tone: "emerald" },
  { value: "ON_HOLD", label: "On hold", tone: "amber" },
  { value: "COMPLETED", label: "Completed", tone: "indigo" },
  { value: "ARCHIVED", label: "Archived", tone: "slate" },
];

export const projectStatusMeta = (value: ProjectStatus) =>
  PROJECT_STATUSES.find((s) => s.value === value) ?? PROJECT_STATUSES[0]!;

export const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "select", label: "Select" },
  { value: "user", label: "Person" },
];

export const SWATCHES = ["#6366F1", "#0EA5E9", "#10B981", "#F59E0B", "#EF4444", "#EC4899", "#A855F7", "#64748B"];

/** "2026-11-04" -> local Date at midnight (avoids the UTC shift of `new Date("2026-11-04")`). */
export function parseDay(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const dayFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const dayYearFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });

export function formatDay(value: string): string {
  const date = parseDay(value);
  return (date.getFullYear() === new Date().getFullYear() ? dayFormat : dayYearFormat).format(date);
}

export type DueStatus = "overdue" | "today" | "soon" | "later";

export function dueStatus(due: string, done: boolean): DueStatus | null {
  if (done) return null;
  const today = todayIso();
  if (due < today) return "overdue";
  if (due === today) return "today";
  const days = (parseDay(due).getTime() - parseDay(today).getTime()) / 86_400_000;
  return days <= 3 ? "soon" : "later";
}

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

export function timeAgo(iso: string): string {
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

/** Suggest a short code from a name: "Qore Platform" -> "QP", "Velocity" -> "VELO". */
export function suggestCode(name: string): string {
  const words = name.toUpperCase().replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const code = words.length === 1 ? words[0]!.slice(0, 4) : words.map((w) => w[0]).join("").slice(0, 6);
  return /^[A-Z]/.test(code) && code.length >= 2 ? code : "";
}
