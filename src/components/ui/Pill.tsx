import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** Rounded counter pill used in the top bar (streak, XP, status). */
export function Pill({ className, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex h-10 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3.5 text-[15px] font-extrabold tabular-nums",
        className,
      )}
      {...rest}
    />
  );
}
