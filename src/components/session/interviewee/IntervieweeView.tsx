"use client";

import { AnimatePresence, m } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import type { SessionView } from "@/lib/realtime/events";
import { emitAck, getSocket } from "@/lib/realtime/socket";

/** Candidate workspace: problem + live revealed facts, a private notepad, and I'm Stuck (R21–R23). */
export function IntervieweeView({ view }: { view: SessionView }) {
  const c = view.interviewee!;
  const [asking, setAsking] = useState(false);
  const stuck = async () => {
    setAsking(true);
    const r = await emitAck("session:hint", { sessionId: view.id });
    setAsking(false);
    if (!r.ok) toast(r.error, "warning");
  };

  return (
    <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="scrollbar-thin min-h-0 overflow-y-auto border-r border-line p-5 sm:p-6" aria-label="Problem and revealed facts">
        <div className="rounded-3xl border border-royal-bright/40 bg-royal-soft p-5">
          <p className="mb-1 text-xs font-extrabold uppercase tracking-[0.12em] text-royal-bright">Problem statement</p>
          <p className="text-[17px] font-semibold leading-relaxed">{c.problemStatement}</p>
        </div>

        <h2 className="mb-3 mt-6 text-sm font-extrabold uppercase tracking-[0.12em] text-muted">Revealed case facts</h2>
        {c.revealedFacts.length === 0 && <p className="text-sm text-faint">Facts appear here as your interviewer reveals them. Ask good questions!</p>}
        <ol className="space-y-2.5" aria-live="polite">
          <AnimatePresence initial={false}>
            {c.revealedFacts.map((f) => (
              <m.li
                key={f.id}
                layout
                initial={{ opacity: 0, y: 12, boxShadow: "0 0 0 2px #22c55e" }}
                animate={{ opacity: 1, y: 0, boxShadow: "0 0 0 0px #22c55e00" }}
                transition={{ duration: 0.5 }}
                className="rounded-2xl border border-line bg-surface p-4 text-[15px] leading-relaxed"
                data-testid="revealed-fact"
              >
                {f.text}
              </m.li>
            ))}
          </AnimatePresence>
        </ol>

        <div className="mt-8 border-t border-line pt-6">
          <Button variant="warning" disabled={c.hintsRemaining === 0 || asking || view.status !== "ACTIVE"} onClick={stuck}>
            <Lightbulb size={18} aria-hidden /> {c.hintsRemaining === 0 ? "No more hints" : "I'm Stuck 💡"}
          </Button>
          <ul className="mt-4 space-y-2.5" aria-live="polite">
            {c.usedHints.map((h) => (
              <li key={h.id} className="flex gap-3 rounded-2xl border border-amber/50 bg-amber-soft p-4 text-[15px] leading-relaxed text-ink" data-testid="hint-card">
                <Lightbulb size={18} className="mt-0.5 shrink-0 text-amber" aria-hidden />
                {h.text}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <Notepad sessionId={view.id} round={view.round} initial={c.notepad} readOnly={view.status !== "ACTIVE"} />
    </div>
  );
}

function Notepad({ sessionId, round, initial, readOnly }: { sessionId: string; round: number; initial: string; readOnly: boolean }) {
  const [text, setText] = useState(initial);
  const [state, setState] = useState<"saved" | "saving" | "error">("saved");
  const timer = useRef<number | null>(null);

  // Another tab of mine saved: adopt it.
  useEffect(() => {
    const s = getSocket();
    const onSync = (p: { sessionId: string; round: number; content: string }) => {
      if (p.sessionId === sessionId && p.round === round) setText(p.content);
    };
    s.on("notepad:sync", onSync);
    return () => {
      s.off("notepad:sync", onSync);
    };
  }, [sessionId, round]);

  const seq = useRef(0);
  const onChange = (v: string) => {
    setText(v);
    setState("saving");
    if (timer.current) window.clearTimeout(timer.current);
    const n = ++seq.current;
    timer.current = window.setTimeout(async () => {
      const r = await emitAck("session:notepad", { sessionId, content: v });
      // An older save's ack must not mark a newer pending edit as saved.
      if (n === seq.current) setState(r.ok ? "saved" : "error");
    }, 600);
  };

  return (
    <section className="flex min-h-[360px] flex-col p-5 sm:p-6" aria-label="Notepad">
      <div className="mb-2 flex items-center justify-between">
        <label htmlFor="notepad" className="text-sm font-extrabold uppercase tracking-[0.12em] text-muted">
          Your notepad
        </label>
        <span className="text-xs font-bold text-faint" role="status">
          {state === "saving" ? "Saving…" : state === "error" ? "Not saved" : "Saved"}
        </span>
      </div>
      <textarea
        id="notepad"
        value={text}
        readOnly={readOnly}
        onChange={(e) => onChange(e.target.value)}
        placeholder={"Structure, math and notes…\n\nOnly you can see this."}
        spellCheck={false}
        className="scrollbar-thin min-h-0 flex-1 resize-none rounded-3xl border border-line bg-surface p-5 font-mono text-[15px] leading-relaxed outline-none focus:border-royal-bright"
      />
    </section>
  );
}
