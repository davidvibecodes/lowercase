import { cn } from "@/lib/cn";

const TONES = ["bg-royal-soft text-royal-bright", "bg-emerald-soft text-emerald", "bg-amber-soft text-amber"];

export function Avatar({ first, last, online, size = "md" }: { first: string; last: string; online?: boolean; size?: "sm" | "md" }) {
  const tone = TONES[(first.charCodeAt(0) + (last.charCodeAt(0) || 0)) % TONES.length];
  return (
    <span className={cn("relative inline-grid shrink-0 place-items-center rounded-full font-extrabold", tone, size === "md" ? "size-10 text-sm" : "size-8 text-xs")} aria-hidden>
      {first[0]}
      {last[0]}
      {online !== undefined && (
        <span
          className={cn("absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-surface", online ? "bg-emerald animate-pulse-dot" : "bg-faint")}
        />
      )}
    </span>
  );
}
