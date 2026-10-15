"use client";

import { m } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Flame, Target, Zap } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { completeLessonAction, type CompleteLessonResult } from "@/app/(focus)/learn/[conceptId]/actions";
import { useGamification } from "@/stores/gamification";
import { lessonAnswers } from "@/stores/lesson";

/** Commits the lesson (the only moment anything is saved) and celebrates it. */
export function CompletionScreen({ concept }: { concept: { id: string; title: string } }) {
  const router = useRouter();
  const [result, setResult] = useState<CompleteLessonResult | null>(null);
  const answers = useRef(lessonAnswers());
  const sent = useRef(false);

  const save = useCallback(async () => {
    setResult(null);
    const r = await completeLessonAction(concept.id, answers.current);
    setResult(r);
    if (r.ok) useGamification.getState().hydrate({ xp: r.totalXp, streak: r.streak });
  }, [concept.id]);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    void save();
  }, [save]);

  return (
    <main className="mx-auto grid min-h-dvh max-w-lg place-items-center px-4 text-center">
      <m.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 26 }} className="w-full">
        <p className="text-sm font-bold uppercase tracking-[0.14em] text-faint">{concept.title}</p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight">Lesson complete!</h1>
        {!result && <p className="mt-6 text-muted" role="status">Saving your progress…</p>}
        {result && !result.ok && (
          <div className="mt-6 rounded-2xl border border-amber/50 bg-amber-soft p-4" role="alert">
            <p className="font-bold text-amber">Couldn&apos;t save. Your answers are still here.</p>
            <Button variant="warning" className="mt-3" onClick={save}>
              Retry
            </Button>
          </div>
        )}
        {result?.ok && (
          <>
            <div className="mt-8 grid grid-cols-3 gap-3">
              <Stat icon={<Zap className="fill-emerald text-emerald" size={22} />} label="XP earned" value={`+${result.xpEarned}`} />
              <Stat icon={<Target className="text-royal-bright" size={22} />} label="First-try accuracy" value={`${Math.round((result.firstTryCorrect / result.total) * 100)}%`} />
              <Stat icon={<Flame className="fill-amber text-amber" size={22} />} label="Day streak" value={String(result.streak)} />
            </div>
            <Button size="lg" block className="mt-8" onClick={() => router.push("/learn")} data-autofocus>
              Continue
            </Button>
          </>
        )}
      </m.div>
    </main>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex justify-center" aria-hidden>
        {icon}
      </div>
      <p className="mt-2 text-2xl font-extrabold tabular-nums">{value}</p>
      <p className="text-xs font-bold text-faint">{label}</p>
    </div>
  );
}
