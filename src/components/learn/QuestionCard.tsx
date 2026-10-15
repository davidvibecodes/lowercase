"use client";

import { Check, X } from "lucide-react";
import { cn } from "@/lib/cn";
import type { LessonQuestion, QuestionState } from "@/stores/lesson";

const LETTERS = "ABCDEFGH";

export function QuestionCard({
  question,
  state,
  onSelect,
  onSubmit,
}: {
  question: LessonQuestion;
  state: QuestionState;
  onSelect: (optionId: string) => void;
  onSubmit: () => void;
}) {
  const locked = state.status === "correct" || state.status === "revealed";
  const glow =
    state.status === "correct" ? "shadow-[var(--shadow-glow-emerald)] border-emerald" : state.status === "incorrect" || state.status === "revealed" ? "shadow-[var(--shadow-glow-amber)] border-amber" : "border-line";

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onSubmit();
      return;
    }
    if (locked || (e.key !== "ArrowDown" && e.key !== "ArrowUp")) return;
    e.preventDefault();
    const i = question.options.findIndex((o) => o.id === state.selected);
    const n = question.options.length;
    const next = question.options[(i + (e.key === "ArrowDown" ? 1 : -1) + n) % n];
    onSelect(next.id);
    (e.currentTarget.querySelector(`[data-option="${next.id}"]`) as HTMLElement | null)?.focus();
  };

  return (
    <section className={cn("rounded-[var(--radius-card)] border bg-surface p-6 transition-[box-shadow,border-color] duration-200 sm:p-7", glow)}>
      {question.kind === "application" && (
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-royal-bright">Case identification</p>
      )}
      {question.scenario && (
        <blockquote className="mb-4 rounded-2xl border-l-4 border-royal-bright bg-obsidian p-4 text-[15px] leading-relaxed text-ink">{question.scenario}</blockquote>
      )}
      <h1 id={`q-${question.id}`} className="text-xl font-extrabold leading-snug tracking-tight">
        {question.prompt}
      </h1>
      <div role="radiogroup" aria-labelledby={`q-${question.id}`} className="mt-5 space-y-2.5" onKeyDown={onKey}>
        {question.options.map((o, i) => {
          const selected = state.selected === o.id;
          const showCorrect = locked && o.isCorrect;
          const showWrong = state.status === "incorrect" && selected;
          const tried = state.attempts.includes(o.id) && !o.isCorrect;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={selected}
              data-option={o.id}
              tabIndex={selected || (!state.selected && i === 0) ? 0 : -1}
              disabled={locked || (tried && state.status === "idle")}
              onClick={() => onSelect(o.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-left text-[16px] font-semibold transition-colors",
                "disabled:cursor-default",
                showCorrect
                  ? "border-emerald bg-emerald-soft"
                  : showWrong
                    ? "border-amber bg-amber-soft"
                    : selected
                      ? "border-royal-bright bg-royal-soft"
                      : tried
                        ? "border-line bg-obsidian opacity-50"
                        : "border-line bg-obsidian hover:border-line-strong",
              )}
            >
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-lg border text-sm font-extrabold",
                  showCorrect ? "border-emerald bg-emerald text-obsidian" : showWrong ? "border-amber bg-amber text-obsidian" : selected ? "border-royal-bright text-royal-bright" : "border-line-strong text-muted",
                )}
                aria-hidden
              >
                {showCorrect ? <Check size={16} /> : showWrong ? <X size={16} /> : LETTERS[i]}
              </span>
              {o.text}
            </button>
          );
        })}
      </div>
    </section>
  );
}
