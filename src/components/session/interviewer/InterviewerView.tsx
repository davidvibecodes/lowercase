"use client";

import { useState } from "react";
import { ChevronDown, Eye, Lightbulb } from "lucide-react";
import { LazyIssueTree } from "@/components/issue-tree/LazyIssueTree";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import type { SessionView } from "@/lib/realtime/events";
import { emitAck } from "@/lib/realtime/socket";
import { RubricPanel } from "./RubricPanel";

function Section({ title, children, defaultOpen = false, badge }: { title: string; children: React.ReactNode; defaultOpen?: boolean; badge?: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-2xl border border-line bg-surface">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left">
        <span className="text-sm font-extrabold uppercase tracking-[0.12em] text-muted">{title}</span>
        <span className="flex items-center gap-2">
          {badge}
          <ChevronDown size={16} className={cn("text-faint transition-transform", open && "rotate-180")} aria-hidden />
        </span>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </section>
  );
}

/** Interviewer cockpit: facts with reveal, case notes, issue tree and rubric (R17–R20). */
export function InterviewerView({ view }: { view: SessionView }) {
  const c = view.interviewer!;
  const solved = view.status === "SOLVED";
  const reveal = async (factId: string) => {
    const r = await emitAck("session:reveal", { sessionId: view.id, factId });
    if (!r.ok) toast(r.error, "warning");
  };

  return (
    <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[360px_1fr_340px]">
      <aside className="scrollbar-thin min-h-0 space-y-4 overflow-y-auto border-r border-line p-4">
        <div className="rounded-2xl border border-royal-bright/40 bg-royal-soft p-4">
          <p className="mb-1 text-xs font-extrabold uppercase tracking-[0.12em] text-royal-bright">Problem statement</p>
          <p className="text-[15px] font-semibold leading-relaxed">{c.problemStatement}</p>
        </div>
        <section aria-label="Case facts">
          <h2 className="mb-2 px-1 text-sm font-extrabold uppercase tracking-[0.12em] text-muted">Case facts</h2>
          <ul className="space-y-2">
            {c.facts.map((f) => (
              <li key={f.id} className={cn("rounded-2xl border p-3", f.revealedAt ? "border-emerald/40 bg-emerald-soft" : "border-line bg-surface")}>
                <p className="text-[14px] leading-snug">{f.text}</p>
                <div className="mt-2 flex justify-end">
                  {f.revealedAt ? (
                    <span className="inline-flex items-center gap-1 text-xs font-extrabold text-emerald">
                      ✓ Revealed {new Date(f.revealedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  ) : (
                    <Button size="sm" variant="primary" disabled={solved} onClick={() => reveal(f.id)}>
                      <Eye size={15} aria-hidden /> Reveal to Candidate
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
        <Section
          title="Hints / interviewee notes"
          defaultOpen
          badge={
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-extrabold", view.hintsUsedCount ? "bg-amber-soft text-amber" : "bg-surface-3 text-faint")}>
              Hint used {view.hintsUsedCount}/{view.hintsTotal}
            </span>
          }
        >
          <ul className="space-y-2">
            {c.hints.map((h) => (
              <li key={h.id} className={cn("flex gap-2 text-[14px] leading-snug", h.usedAt ? "text-amber" : "text-ink")}>
                <Lightbulb size={16} className="mt-0.5 shrink-0" aria-hidden />
                <span>
                  {h.text}
                  {h.usedAt && <span className="ml-1 text-xs font-bold">(shown)</span>}
                </span>
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Recommendations">
          <ul className="list-disc space-y-1.5 pl-5 text-[14px]">
            {c.recommendations.map((r) => (
              <li key={r.id}>{r.text}</li>
            ))}
          </ul>
        </Section>
        <Section title="Observations">
          <ul className="list-disc space-y-1.5 pl-5 text-[14px]">
            {c.observations.map((r) => (
              <li key={r.id}>{r.text}</li>
            ))}
          </ul>
        </Section>
      </aside>

      <section className="relative min-h-[420px] bg-obsidian" aria-label="Issue tree">
        <div className="pointer-events-none absolute left-4 top-3 z-10 flex gap-3 text-xs font-bold">
          <span className="flex items-center gap-1.5 rounded-full bg-surface/90 px-2.5 py-1">
            <span className="size-2.5 rounded-sm bg-royal" /> Correct issue path
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-surface/90 px-2.5 py-1">
            <span className="size-2.5 rounded-sm bg-grey-node ring-1 ring-line-strong" /> Standard branch
          </span>
        </div>
        <LazyIssueTree nodes={c.tree} />
      </section>

      <aside className="scrollbar-thin min-h-0 overflow-y-auto border-l border-line p-4">
        <RubricPanel view={view} />
      </aside>
    </div>
  );
}
