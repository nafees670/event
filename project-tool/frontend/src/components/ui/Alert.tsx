import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type Tone = "error" | "success" | "info";

const tones: Record<Tone, { box: string; Icon: typeof Info }> = {
  error: {
    box: "border-red-200 bg-red-50 text-red-800 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300",
    Icon: AlertCircle,
  },
  success: {
    box: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300",
    Icon: CheckCircle2,
  },
  info: { box: "border-primary/20 bg-primary-soft text-primary-soft-fg", Icon: Info },
};

export function Alert({ tone = "info", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  const { box, Icon } = tones[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("flex animate-fade-in gap-2.5 rounded-lg border px-3 py-2.5 text-[13px] leading-5", box, className)}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
