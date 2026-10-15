import { cn } from "@/lib/cn";

/** Completion ring (value 0..1) with optional centre content. */
export function Ring({
  value,
  size = 64,
  stroke = 6,
  tone = "emerald",
  children,
  className,
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  tone?: "emerald" | "royal" | "amber";
  children?: React.ReactNode;
  className?: string;
  label?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  const color = tone === "emerald" ? "var(--color-emerald)" : tone === "royal" ? "var(--color-royal-bright)" : "var(--color-amber)";
  return (
    <div className={cn("relative inline-grid place-items-center", className)} style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-surface-3)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{ transition: "stroke-dashoffset 600ms ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}
