import { create } from "zustand";
import { XP_FIRST_TRY_CORRECT } from "@/lib/rules/xp";

export type LessonOption = { id: string; text: string; isCorrect: boolean };
export type LessonQuestion = {
  id: string;
  kind: string;
  prompt: string;
  scenario: string | null;
  explanation: string;
  options: LessonOption[];
};

export type QuestionStatus = "idle" | "correct" | "incorrect" | "revealed";

export type QuestionState = {
  selected: string | null;
  attempts: string[];
  status: QuestionStatus;
  revealed: boolean;
};

export type LessonPhase = "explainers" | "questions" | "complete";

type LessonData = {
  explainerCount: number;
  questions: LessonQuestion[];
  phase: LessonPhase;
  explainerIndex: number;
  questionIndex: number;
  states: QuestionState[];
  pendingXp: number;
};

type LessonActions = {
  start: (p: { explainerCount: number; questions: LessonQuestion[] }) => void;
  nextExplainer: () => void;
  select: (optionId: string) => void;
  check: () => QuestionStatus | null;
  tryAgain: () => void;
  seeAnswer: () => void;
  next: () => void;
  reset: () => void;
};

const empty: LessonData = { explainerCount: 0, questions: [], phase: "explainers", explainerIndex: 0, questionIndex: 0, states: [], pendingXp: 0 };
const fresh = (): QuestionState => ({ selected: null, attempts: [], status: "idle", revealed: false });

/** Client-only lesson state: every interaction is synchronous (sub-50 ms feedback). Nothing persists until completion. */
export const useLesson = create<LessonData & LessonActions>((set, get) => {
  const patch = (fn: (q: QuestionState, question: LessonQuestion) => Partial<QuestionState>, extra: Partial<LessonData> = {}) => {
    const s = get();
    const states = [...s.states];
    states[s.questionIndex] = { ...states[s.questionIndex], ...fn(states[s.questionIndex], s.questions[s.questionIndex]) };
    set({ states, ...extra });
  };

  return {
    ...empty,
    start: ({ explainerCount, questions }) =>
      set({ ...empty, explainerCount, questions, phase: explainerCount > 0 ? "explainers" : questions.length ? "questions" : "complete", states: questions.map(fresh) }),

    nextExplainer: () => {
      const s = get();
      if (s.explainerIndex + 1 < s.explainerCount) set({ explainerIndex: s.explainerIndex + 1 });
      else set({ phase: s.questions.length ? "questions" : "complete" });
    },

    select: (optionId) => {
      const s = get();
      const q = s.states[s.questionIndex];
      if (!q || q.status === "correct" || q.status === "revealed") return;
      patch(() => ({ selected: optionId, status: "idle" }));
    },

    check: () => {
      const s = get();
      const q = s.states[s.questionIndex];
      const question = s.questions[s.questionIndex];
      if (!q?.selected || q.status !== "idle") return null;
      const correct = question.options.find((o) => o.id === q.selected)?.isCorrect ?? false;
      const firstTry = q.attempts.length === 0;
      patch(() => ({ attempts: [...q.attempts, q.selected!], status: correct ? "correct" : "incorrect" }), {
        pendingXp: s.pendingXp + (correct && firstTry ? XP_FIRST_TRY_CORRECT : 0),
      });
      return correct ? "correct" : "incorrect";
    },

    tryAgain: () => patch((q) => (q.status === "incorrect" ? { status: "idle", selected: null } : {})),

    seeAnswer: () =>
      patch((q, question) => (q.status === "incorrect" ? { status: "revealed", revealed: true, selected: question.options.find((o) => o.isCorrect)?.id ?? null } : {})),

    next: () => {
      const s = get();
      const q = s.states[s.questionIndex];
      if (!q || (q.status !== "correct" && q.status !== "revealed")) return;
      if (s.questionIndex + 1 < s.questions.length) set({ questionIndex: s.questionIndex + 1 });
      else set({ phase: "complete" });
    },

    reset: () => set(empty),
  };
});

/** The payload the server recomputes from (U8). */
export function lessonAnswers(): Array<{ questionId: string; attempts: string[]; revealed: boolean }> {
  const s = useLesson.getState();
  return s.questions.map((q, i) => ({ questionId: q.id, attempts: s.states[i].attempts, revealed: s.states[i].revealed }));
}
