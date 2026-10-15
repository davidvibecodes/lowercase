/** Adaptive lesson length and question selection (KTD10, R13). */

export const ACCURACY_THRESHOLD = 0.8;
export const MIN_ANSWERS_FOR_REDUCED = 5;
export const HISTORY_WINDOW = 20;

export type LessonMode = "high-volume" | "reduced";

/** `history`: first-attempt results on this concept, oldest first. */
export function lessonTarget(history: boolean[], rng: () => number = Math.random): { mode: LessonMode; target: number; accuracy: number | null } {
  const recent = history.slice(-HISTORY_WINDOW);
  const accuracy = recent.length ? recent.filter(Boolean).length / recent.length : null;
  const reduced = history.length >= MIN_ANSWERS_FOR_REDUCED && accuracy !== null && accuracy >= ACCURACY_THRESHOLD;
  const target = reduced ? 2 + Math.floor(rng() * 2) : 6 + Math.floor(rng() * 3);
  return { mode: reduced ? "reduced" : "high-volume", target, accuracy };
}

export function shuffle<T>(items: T[], rng: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Picks the lesson's questions from the unmastered pool. Never empty while the pool isn't. */
export function selectLessonQuestions<T>(unmastered: T[], history: boolean[], rng: () => number = Math.random) {
  const { mode, target } = lessonTarget(history, rng);
  const questions = shuffle(unmastered, rng).slice(0, Math.min(target, unmastered.length));
  return { questions, mode, target, mastered: unmastered.length === 0 };
}
