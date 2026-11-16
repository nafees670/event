import { BarChart3, KanbanSquare, MessagesSquare, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

import { Logo, LogoMark } from "./Logo";

const FEATURES = [
  { icon: KanbanSquare, title: "Boards per space", text: "Each team keeps its own workflow, all in one place." },
  { icon: BarChart3, title: "Real progress", text: "Weighted milestones show where projects actually stand." },
  { icon: MessagesSquare, title: "Team in sync", text: "Chat, meetings and daily reports next to the work." },
  { icon: Sparkles, title: "AI built in", text: "Ask about your projects or create tasks in plain words." },
];

/** Split layout for signed-out pages: brand panel on large screens, form on the right. */
export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full">
      <aside className="relative hidden w-[44%] max-w-xl overflow-hidden bg-[#0d0e1a] p-12 text-white lg:flex lg:flex-col">
        <div
          aria-hidden
          className="absolute -top-40 -left-32 h-[28rem] w-[28rem] rounded-full bg-indigo-600/40 blur-[120px]"
        />
        <div aria-hidden className="absolute right-0 -bottom-40 h-96 w-96 rounded-full bg-fuchsia-600/25 blur-[120px]" />
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(white_1px,transparent_1px),linear-gradient(90deg,white_1px,transparent_1px)] [background-size:48px_48px]"
        />
        <div className="relative flex items-center gap-2.5 text-[15px] font-semibold">
          <LogoMark />
          PM Suite
        </div>
        <div className="relative mt-auto">
          <h2 className="max-w-sm text-3xl leading-tight font-semibold tracking-tight">
            Plan, track and ship work across every team.
          </h2>
          <ul className="mt-10 space-y-6">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                  <Icon className="h-4 w-4 text-indigo-200" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-medium">{title}</p>
                  <p className="mt-0.5 text-sm text-white/60">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </aside>
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-8">
        <Logo className="mb-10 lg:hidden" />
        <div className="w-full max-w-sm animate-slide-up">{children}</div>
      </main>
    </div>
  );
}

export function AuthHeading({ title, subtitle }: { title: string; subtitle?: ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
      {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
    </div>
  );
}
