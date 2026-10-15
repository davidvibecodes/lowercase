"use client";

import { cn } from "@/lib/cn";

/** Segmented control. Keyboard: arrow keys move selection. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = "md",
  className,
}: {
  options: Array<{ value: T; label: React.ReactNode; disabled?: boolean }>;
  value: T;
  onChange: (v: T) => void;
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const enabled = options.filter((o) => !o.disabled);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const i = enabled.findIndex((o) => o.value === value);
    const next = enabled[(i + (e.key === "ArrowRight" ? 1 : -1) + enabled.length) % enabled.length];
    if (next) onChange(next.value);
  };
  return (
    <div role="radiogroup" aria-label={label} onKeyDown={onKey} className={cn("inline-flex flex-wrap gap-1 rounded-2xl border border-line bg-obsidian p-1", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-xl font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              size === "sm" ? "px-3 py-1.5 text-xs" : "px-3.5 py-2 text-sm",
              active ? "bg-surface-3 text-ink shadow-[inset_0_0_0_1px_var(--color-line-strong)]" : "text-muted hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
