import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-[var(--radius-card)] border border-line bg-surface", className)}
      {...rest}
    />
  );
}

export function CardHeader({ title, action, eyebrow }: { title: string; action?: React.ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        {eyebrow && <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-faint">{eyebrow}</p>}
        <h2 className="text-lg font-extrabold tracking-tight">{title}</h2>
      </div>
      {action}
    </div>
  );
}
