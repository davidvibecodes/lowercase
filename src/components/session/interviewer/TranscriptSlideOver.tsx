"use client";

import { useState } from "react";
import { ScrollText } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SlideOver } from "@/components/ui/SlideOver";
import { cn } from "@/lib/cn";

type Turn = { id: string; speaker: "interviewer" | "candidate"; text: string };

/** One button, one full transcript (R19). No node-to-transcript syncing. */
export function TranscriptButton({ transcript }: { transcript: Turn[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <ScrollText size={16} aria-hidden /> View Full Transcript
      </Button>
      <SlideOver open={open} onClose={() => setOpen(false)} title={`Interview transcript · ${transcript.length} turns`}>
        <ol className="space-y-2.5">
          {transcript.map((t) => (
            <li key={t.id} className={cn("rounded-2xl px-4 py-3 text-[15px] leading-relaxed", t.speaker === "interviewer" ? "bg-surface-2" : "border border-royal-bright/30 bg-royal-soft")}>
              <p className={cn("mb-1 text-xs font-extrabold uppercase tracking-[0.12em]", t.speaker === "interviewer" ? "text-faint" : "text-royal-bright")}>
                {t.speaker === "interviewer" ? "Interviewer" : "Candidate"}
              </p>
              {t.text}
            </li>
          ))}
        </ol>
      </SlideOver>
    </>
  );
}
