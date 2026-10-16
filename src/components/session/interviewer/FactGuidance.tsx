"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import type { FactGuidance as Guidance } from "@/lib/realtime/events";

const CATEGORY_LABEL: Record<string, string> = {
  CLARIFYING_SCOPING: "Clarifying",
  TREE_DIRECTIONAL: "Directional",
  TREE_ELIMINATION: "Elimination",
  ROOT_CAUSE: "Root cause",
};

/** The casebank's advisory reveal guidance (R26). Open while the fact is unrevealed; folds away once revealed. */
export function FactGuidance({ guidance, revealed }: { guidance: Guidance; revealed: boolean }) {
  const [open, setOpen] = useState(!revealed);
  useEffect(() => {
    if (revealed) setOpen(false);
  }, [revealed]);
  const rows: Array<[string, string | null]> = [
    ["Reveal when", guidance.trigger],
    ["Cover first", guidance.coverFirst.length ? guidance.coverFirst.join(" → ") : null],
    ["Don't leak", guidance.antiLeak],
    ["If skipped, nudge", guidance.nudge],
  ];
  return (
    <div className="mt-2">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 text-left text-xs font-bold text-muted hover:text-ink">
        {guidance.category && (
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-extrabold", guidance.category === "ROOT_CAUSE" ? "bg-amber-soft text-amber" : "bg-surface-3 text-muted")}>
            {CATEGORY_LABEL[guidance.category] ?? guidance.category}
          </span>
        )}
        {guidance.node && <span className="truncate text-faint">{guidance.node}</span>}
        <span className="ml-auto inline-flex items-center gap-1">
          Guidance <ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} aria-hidden />
        </span>
      </button>
      {open && (
        <dl className="mt-2 space-y-1.5 rounded-xl bg-obsidian/60 p-2.5 text-[13px] leading-snug">
          {rows
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k}>
                <dt className={cn("text-[11px] font-extrabold uppercase tracking-[0.1em]", k === "Don't leak" ? "text-amber" : "text-faint")}>{k}</dt>
                <dd className="text-ink">{v}</dd>
              </div>
            ))}
        </dl>
      )}
    </div>
  );
}
