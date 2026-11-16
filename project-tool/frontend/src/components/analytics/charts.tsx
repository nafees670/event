"use client";

import { AlertTriangle } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from "recharts";

import { Card } from "@/components/ui/PageHeader";
import type { Analytics, StateCategory } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { parseDay } from "@/lib/tasks";

/** Fixed categorical order: a category always keeps its colour, whatever else is on screen. */
export const CATEGORY_SERIES: Record<StateCategory, string> = {
  BACKLOG: "var(--series-1)",
  UNSTARTED: "var(--series-2)",
  STARTED: "var(--series-3)",
  REVIEW: "var(--series-4)",
  COMPLETED: "var(--series-5)",
  CANCELLED: "var(--series-6)",
};

const weekFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

export function ChartCard({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("p-5", className)}>
      <h2 className="text-[15px] font-semibold text-fg">{title}</h2>
      {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
      <div className="mt-4">{children}</div>
    </Card>
  );
}

export function StatTile({
  label,
  value,
  note,
  alert,
}: {
  label: string;
  value: number;
  note?: string;
  /** Turns the tile into a status cue (icon + label, never colour alone). */
  alert?: string;
}) {
  return (
    <Card className="p-5">
      <p className="text-[13px] text-muted">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight text-fg">{value.toLocaleString()}</p>
      {alert ? (
        <p className="mt-1 flex items-center gap-1 text-xs font-medium text-fg">
          <AlertTriangle className="h-3.5 w-3.5 text-status-critical" aria-hidden />
          {alert}
        </p>
      ) : (
        note && <p className="mt-1 text-xs text-muted">{note}</p>
      )}
    </Card>
  );
}

function VelocityTooltip({ active, payload }: TooltipProps<number, string>) {
  const row = payload?.[0]?.payload as { week_start: string; completed: number } | undefined;
  if (!active || !row) return null;
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-pop">
      <p className="text-muted">Week of {weekFormat.format(parseDay(row.week_start))}</p>
      <p className="mt-0.5 font-semibold text-fg">
        {row.completed} {row.completed === 1 ? "task" : "tasks"} completed
      </p>
    </div>
  );
}

/** Tasks completed per week. One series, so no legend: the card title names it. */
export function VelocityChart({ data }: { data: Analytics["velocity"] }) {
  const [table, setTable] = useState(false);
  const average = data.reduce((sum, w) => sum + w.completed, 0) / Math.max(data.length, 1);
  return (
    <ChartCard
      title="Velocity"
      description={
        <>
          Tasks completed per week · average {average.toFixed(1)} a week
          <button type="button" onClick={() => setTable((v) => !v)} className="ml-2 text-primary hover:underline">
            {table ? "Show chart" : "Show as table"}
          </button>
        </>
      }
    >
      {table ? (
        <table className="w-full text-left text-[13px]">
          <thead className="text-xs text-muted">
            <tr>
              <th className="py-1.5 font-medium">Week of</th>
              <th className="py-1.5 text-right font-medium">Completed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border tabular-nums">
            {data.map((w) => (
              <tr key={w.week_start}>
                <td className="py-1.5 text-fg">{weekFormat.format(parseDay(w.week_start))}</td>
                <td className="py-1.5 text-right text-fg">{w.completed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="h-56" role="img" aria-label={`Tasks completed per week, last ${data.length} weeks, average ${average.toFixed(1)}`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis
                dataKey="week_start"
                tickFormatter={(value: string) => weekFormat.format(parseDay(value))}
                tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "var(--chart-grid)" }}
                interval="preserveStartEnd"
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <Tooltip content={<VelocityTooltip />} cursor={{ fill: "var(--surface-2)" }} />
              <Bar dataKey="completed" fill="var(--seq-fill)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}

/** Share of tasks per status group: one stacked bar plus a legend that doubles as the table. */
export function StatusBreakdown({ data }: { data: Analytics["status_distribution"] }) {
  const total = data.reduce((sum, row) => sum + row.count, 0);
  const [hover, setHover] = useState<StateCategory | null>(null);
  return (
    <ChartCard title="Status" description={`${total} tasks by status group`}>
      {total === 0 ? (
        <p className="text-[13px] text-muted">No tasks yet.</p>
      ) : (
        <>
          <div className="flex h-3 gap-[2px] overflow-hidden rounded-full" aria-hidden>
            {data
              .filter((row) => row.count > 0)
              .map((row) => (
                <div
                  key={row.category}
                  onMouseEnter={() => setHover(row.category)}
                  onMouseLeave={() => setHover(null)}
                  title={`${row.label}: ${row.count}`}
                  className={cn("h-full transition-opacity", hover && hover !== row.category && "opacity-40")}
                  style={{ width: `${(row.count / total) * 100}%`, backgroundColor: CATEGORY_SERIES[row.category] }}
                />
              ))}
          </div>
          <ul className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {data.map((row) => (
              <li
                key={row.category}
                onMouseEnter={() => setHover(row.category)}
                onMouseLeave={() => setHover(null)}
                className="flex items-center gap-2 text-[13px]"
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: CATEGORY_SERIES[row.category] }} aria-hidden />
                <span className="flex-1 text-muted">{row.label}</span>
                <span className="font-medium text-fg tabular-nums">{row.count}</span>
                <span className="w-10 text-right text-xs text-subtle tabular-nums">{Math.round((row.count / total) * 100)}%</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </ChartCard>
  );
}

/** Utilisation meter: blue while healthy, then warning and critical, each with a text label. */
export function CapacityMeter({ value }: { value: number }) {
  const level = value > 100 ? "critical" : value >= 80 ? "warning" : "ok";
  const fill = level === "critical" ? "var(--status-critical)" : level === "warning" ? "var(--status-warning)" : "var(--seq-fill)";
  return (
    <div className="flex items-center gap-2">
      <div
        role="meter"
        aria-label="Capacity used"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        className="h-1.5 w-24 overflow-hidden rounded-full bg-seq-track"
      >
        <div className="h-full rounded-full" style={{ width: `${Math.min(value, 100)}%`, backgroundColor: fill }} />
      </div>
      <span className="w-20 text-xs text-fg tabular-nums">
        {value}%{level === "critical" ? " · over" : level === "warning" ? " · full" : ""}
      </span>
    </div>
  );
}
