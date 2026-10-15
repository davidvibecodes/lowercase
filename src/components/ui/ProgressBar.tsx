import { cn } from "@/lib/cn";

/** Continuous bar (value 0..1). */
export function ProgressBar({ value, tone = "emerald", className, label }: { value: number; tone?: "emerald" | "royal"; className?: string; label?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={cn("h-2.5 w-full overflow-hidden rounded-full bg-surface-3", className)}
    >
      <div
        className={cn("h-full origin-left rounded-full transition-transform duration-500 ease-out", tone === "emerald" ? "bg-emerald" : "bg-royal-bright")}
        style={{ transform: `scaleX(${pct / 100})` }}
      />
    </div>
  );
}

/** Segmented bar: one segment per step (lesson top bar). */
export function SegmentedProgress({ total, done, label }: { total: number; done: number; label?: string }) {
  return (
    <div className="flex w-full gap-1.5" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-3">
          <div
            className="h-full origin-left rounded-full bg-emerald transition-transform duration-300 ease-out"
            style={{ transform: `scaleX(${i < done ? 1 : 0})` }}
          />
        </div>
      ))}
    </div>
  );
}
