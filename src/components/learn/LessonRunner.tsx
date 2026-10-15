"use client";

import { AnimatePresence, m } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { HelpCircle, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Markdown } from "@/components/ui/Markdown";
import { Modal } from "@/components/ui/Modal";
import { SegmentedProgress } from "@/components/ui/ProgressBar";
import { playChime } from "@/lib/chime";
import { useActivity } from "@/stores/activity";
import { useLesson, type LessonQuestion } from "@/stores/lesson";
import { CompletionScreen } from "./CompletionScreen";
import { QuestionCard } from "./QuestionCard";

export type LessonData = {
  concept: { id: string; slug: string; title: string; icon: string };
  explainers: Array<{ id: string; title: string; body: string }>;
  questions: LessonQuestion[];
  mode: "high-volume" | "reduced";
  soundOn: boolean;
};

export function LessonRunner({ lesson }: { lesson: LessonData }) {
  const router = useRouter();
  const s = useLesson();
  const [quitOpen, setQuitOpen] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  const [xpBurst, setXpBurst] = useState(0);

  // Start once per mount. The completion action refreshes the route, which hands
  // us a fresh lesson prop; ignoring it keeps the completion screen in place.
  const [initial] = useState(lesson);
  useEffect(() => {
    useLesson.getState().start({ explainerCount: initial.explainers.length, questions: initial.questions });
    useActivity.getState().setLessonInProgress(true);
    return () => {
      useActivity.getState().setLessonInProgress(false);
      useLesson.getState().reset();
    };
  }, [initial]);

  useEffect(() => {
    if (s.phase === "complete") useActivity.getState().setLessonInProgress(false);
  }, [s.phase]);

  const started = s.questions.length > 0 || s.explainerCount > 0;
  if (!started) return null;
  if (s.phase === "complete") return <CompletionScreen concept={lesson.concept} />;

  const total = s.explainerCount + s.questions.length;
  const q = s.questions[s.questionIndex];
  const qs = s.states[s.questionIndex];
  const resolved = qs && (qs.status === "correct" || qs.status === "revealed");
  const done = s.phase === "explainers" ? s.explainerIndex : s.explainerCount + s.questionIndex + (resolved ? 1 : 0);

  const onCheck = () => {
    const r = useLesson.getState().check();
    setWhyOpen(false);
    if (r === "correct") {
      if (useLesson.getState().states[useLesson.getState().questionIndex].attempts.length === 1) setXpBurst((n) => n + 1);
      if (lesson.soundOn) playChime();
    }
  };
  const onContinue = () => {
    setWhyOpen(false);
    useLesson.getState().next();
  };

  const quit = () => {
    useLesson.getState().reset();
    useActivity.getState().setLessonInProgress(false);
    router.push("/learn");
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-obsidian/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-4 px-4">
          <button type="button" aria-label="Quit lesson" onClick={() => setQuitOpen(true)} className="grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink">
            <X size={22} />
          </button>
          <div className="flex-1">
            <SegmentedProgress total={total} done={done} label="Lesson progress" />
          </div>
          <span className="relative inline-flex h-9 items-center gap-1 rounded-full border border-line-strong px-3 text-sm font-extrabold tabular-nums" aria-label={`${s.pendingXp} XP this lesson`}>
            {s.pendingXp}
            <Zap size={16} className="fill-emerald text-emerald" aria-hidden />
            <AnimatePresence>
              {xpBurst > 0 && (
                <m.span
                  key={xpBurst}
                  initial={{ opacity: 0, y: 6, scale: 0.8 }}
                  animate={{ opacity: 1, y: -26, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.55, ease: "easeOut" }}
                  onAnimationComplete={() => setXpBurst(0)}
                  className="absolute -top-1 right-0 rounded-full bg-emerald px-2 py-0.5 text-xs font-extrabold text-obsidian"
                >
                  +15 XP
                </m.span>
              )}
            </AnimatePresence>
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-40 pt-8">
        <p className="mb-4 text-sm font-bold uppercase tracking-[0.14em] text-faint">{lesson.concept.title}</p>
        <AnimatePresence mode="wait">
          {s.phase === "explainers" ? (
            <m.article
              key={`e${s.explainerIndex}`}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.18 }}
              className="rounded-[var(--radius-card)] border border-line bg-surface p-7"
            >
              <h1 className="text-2xl font-extrabold tracking-tight">{lesson.explainers[s.explainerIndex].title}</h1>
              <div className="mt-3 text-[16px]">
                <Markdown source={lesson.explainers[s.explainerIndex].body} />
              </div>
            </m.article>
          ) : (
            <m.div key={`q${s.questionIndex}`} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.18 }}>
              <QuestionCard question={q} state={qs} onSelect={(id) => useLesson.getState().select(id)} onSubmit={() => (resolved ? onContinue() : onCheck())} />
            </m.div>
          )}
        </AnimatePresence>
      </main>

      <footer
        className={
          "fixed inset-x-0 bottom-0 z-30 border-t transition-colors " +
          (qs?.status === "correct" && s.phase === "questions"
            ? "border-emerald/50 bg-[#0f1f16]"
            : (qs?.status === "incorrect" || qs?.status === "revealed") && s.phase === "questions"
              ? "border-amber/50 bg-[#22190a]"
              : "border-line bg-obsidian")
        }
      >
        <div className="mx-auto max-w-2xl px-4 py-4">
          {s.phase === "explainers" ? (
            <div className="flex justify-end">
              <Button size="lg" className="min-w-40" onClick={() => useLesson.getState().nextExplainer()} data-autofocus>
                Continue
              </Button>
            </div>
          ) : (
            <Feedback
              status={qs.status}
              hasSelection={Boolean(qs.selected)}
              explanation={q.explanation}
              whyOpen={whyOpen}
              onWhy={() => setWhyOpen((o) => !o)}
              onCheck={onCheck}
              onContinue={onContinue}
              onTryAgain={() => {
                setWhyOpen(false);
                useLesson.getState().tryAgain();
              }}
              onSeeAnswer={() => useLesson.getState().seeAnswer()}
            />
          )}
        </div>
      </footer>

      <Modal open={quitOpen} onClose={() => setQuitOpen(false)} title="Are you sure?">
        <p className="text-muted">If you quit, you will lose your progress and XP.</p>
        <div className="mt-6 flex gap-3">
          <Button variant="primary" className="flex-1" onClick={() => setQuitOpen(false)} data-autofocus>
            Keep learning
          </Button>
          <Button variant="secondary" className="flex-1" onClick={quit}>
            Quit
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function Feedback(p: {
  status: "idle" | "correct" | "incorrect" | "revealed";
  hasSelection: boolean;
  explanation: string;
  whyOpen: boolean;
  onWhy: () => void;
  onCheck: () => void;
  onContinue: () => void;
  onTryAgain: () => void;
  onSeeAnswer: () => void;
}) {
  const why = (
    <Button variant="ghost" onClick={p.onWhy} aria-expanded={p.whyOpen}>
      <HelpCircle size={18} aria-hidden /> Why?
    </Button>
  );
  return (
    <div>
      <div aria-live="polite" className="sr-only">
        {p.status === "correct" ? "Correct" : p.status === "incorrect" ? "Not quite" : p.status === "revealed" ? "Answer shown" : ""}
      </div>
      {p.whyOpen && p.status !== "idle" && (
        <div className="mb-4 rounded-2xl border border-line bg-surface p-4 text-[15px] leading-relaxed" data-testid="why-panel">
          {p.explanation}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-lg font-extrabold">
          {p.status === "correct" && <span className="text-emerald">✓ Correct!</span>}
          {p.status === "incorrect" && <span className="text-amber">✕ Not quite</span>}
          {p.status === "revealed" && <span className="text-amber">Here&apos;s the answer</span>}
        </p>
        <div className="flex flex-wrap gap-2">
          {p.status === "idle" && (
            <Button size="lg" className="min-w-40" disabled={!p.hasSelection} onClick={p.onCheck}>
              Check
            </Button>
          )}
          {p.status === "correct" && (
            <>
              {why}
              <Button size="lg" variant="success" className="min-w-40" onClick={p.onContinue}>
                Continue
              </Button>
            </>
          )}
          {p.status === "incorrect" && (
            <>
              {why}
              <Button size="lg" variant="secondary" onClick={p.onSeeAnswer}>
                See Answer
              </Button>
              <Button size="lg" variant="warning" onClick={p.onTryAgain}>
                Try Again
              </Button>
            </>
          )}
          {p.status === "revealed" && (
            <>
              {why}
              <Button size="lg" className="min-w-40" onClick={p.onContinue}>
                Continue
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
