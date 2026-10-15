"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import type { SessionView } from "@/lib/realtime/events";
import { emitAck } from "@/lib/realtime/socket";
import { averageScore, RUBRIC_CRITERIA } from "@/lib/rules/rubric";

/** 1–5 per criterion + notes; Mark Case Solved needs all six (R20). */
export function RubricPanel({ view }: { view: SessionView }) {
  const [scores, setScores] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const complete = RUBRIC_CRITERIA.every((c) => scores[c.key]);
  const solved = view.status === "SOLVED";
  const avg = averageScore(Object.values(scores));

  const submit = async () => {
    setConfirm(false);
    setBusy(true);
    const r = await emitAck("session:solve", {
      sessionId: view.id,
      scores: RUBRIC_CRITERIA.map((c) => ({ criterion: c.key, score: scores[c.key], notes: notes[c.key] ?? "" })),
    });
    setBusy(false);
    if (!r.ok) toast(r.error, "warning");
  };

  return (
    <div>
      <h2 className="text-sm font-extrabold uppercase tracking-[0.12em] text-muted">Rubric</h2>
      <p className="mb-4 text-xs text-faint">Score {view.partner?.firstName ?? "the candidate"} from 1 (weak) to 5 (excellent).</p>
      <ol className="space-y-3">
        {RUBRIC_CRITERIA.map((c) => (
          <li key={c.key} className="rounded-2xl border border-line bg-surface p-3">
            <p className="text-sm font-extrabold" id={`crit-${c.key}`}>
              {c.label}
            </p>
            <p className="mt-0.5 text-xs text-faint">{c.description}</p>
            <div role="radiogroup" aria-labelledby={`crit-${c.key}`} className="mt-2 grid grid-cols-5 gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => {
                const on = scores[c.key] === n;
                return (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={`${c.label}: ${n}`}
                    disabled={solved}
                    onClick={() => setScores((s) => ({ ...s, [c.key]: n }))}
                    className={cn(
                      "h-9 rounded-lg border text-sm font-extrabold tabular-nums transition-colors",
                      on ? (n >= 4 ? "border-emerald bg-emerald text-obsidian" : n <= 2 ? "border-amber bg-amber text-obsidian" : "border-royal-bright bg-royal text-white") : "border-line bg-obsidian text-muted hover:border-line-strong",
                    )}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
            <label className="sr-only" htmlFor={`note-${c.key}`}>
              Notes on {c.label}
            </label>
            <textarea
              id={`note-${c.key}`}
              rows={1}
              placeholder="Notes (optional)"
              disabled={solved}
              value={notes[c.key] ?? ""}
              onChange={(e) => setNotes((x) => ({ ...x, [c.key]: e.target.value }))}
              className="mt-2 w-full resize-y rounded-lg border border-line bg-obsidian px-2.5 py-1.5 text-sm outline-none focus:border-royal-bright"
            />
          </li>
        ))}
      </ol>
      <div className="sticky bottom-0 mt-4 bg-obsidian pb-1 pt-3">
        <p className="mb-2 text-sm font-bold text-muted">
          Average: <span className="tabular-nums text-ink">{Object.keys(scores).length ? avg.toFixed(1) : "–"}</span>
        </p>
        <Button size="lg" block variant="success" disabled={!complete || solved || busy} onClick={() => setConfirm(true)}>
          <CheckCircle2 size={18} aria-hidden /> Mark Case Solved
        </Button>
      </div>
      <Modal open={confirm} onClose={() => setConfirm(false)} title="Mark the case solved?">
        <p className="text-muted">
          {view.partner?.firstName ?? "The candidate"} scores <strong className="text-ink">{avg.toFixed(1)} / 5</strong>. This ends the round for both of you.
        </p>
        <div className="mt-6 flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => setConfirm(false)}>
            Keep going
          </Button>
          <Button variant="success" className="flex-1" onClick={submit} data-autofocus>
            Mark solved
          </Button>
        </div>
      </Modal>
    </div>
  );
}
