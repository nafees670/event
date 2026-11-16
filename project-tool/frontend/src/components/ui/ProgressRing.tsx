import { cn } from "@/lib/cn";

/**
 * A single-value meter drawn as a ring: blue fill on a lighter step of the same ramp.
 * The number sits inside, so the value never depends on reading the arc.
 */
export function ProgressRing({
  value,
  size = 56,
  stroke = 6,
  label,
  className,
}: {
  /** 0-100 */
  value: number;
  size?: number;
  stroke?: number;
  label: string;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const rounded = Math.round(clamped);
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={rounded}
      aria-valuetext={`${rounded}%`}
      title={`${label}: ${clamped}%`}
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--seq-track)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--seq-fill)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
          // A zero-length round cap still draws a dot; hide the arc at 0%.
          opacity={clamped === 0 ? 0 : 1}
        />
      </svg>
      <span className={cn("absolute font-semibold text-fg tabular-nums", size >= 72 ? "text-base" : "text-[12px]")}>{rounded}%</span>
    </div>
  );
}

/** Thin horizontal meter for rows (milestones, spaces). */
export function ProgressBar({ value, label, className }: { value: number; label: string; className?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      className={cn("h-1.5 overflow-hidden rounded-full bg-seq-track", className)}
    >
      <div className="h-full rounded-full bg-seq-fill transition-[width] duration-500" style={{ width: `${clamped}%` }} />
    </div>
  );
}
