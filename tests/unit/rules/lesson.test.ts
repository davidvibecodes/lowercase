import { describe, expect, it } from "vitest";
import { lessonTarget, selectLessonQuestions } from "@/lib/rules/lesson";

const pool = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `q${i}` }));
const seeded = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};
const hist = (correct: number, total: number) => Array.from({ length: total }, (_, i) => i < correct);

describe("adaptive lesson selection (KTD10, R13)", () => {
  it("serves 6–8 questions to a new learner", () => {
    for (let s = 1; s < 30; s++) {
      const r = selectLessonQuestions(pool(10), [], seeded(s));
      expect(r.questions.length).toBeGreaterThanOrEqual(6);
      expect(r.questions.length).toBeLessThanOrEqual(8);
    }
  });

  it("serves 2–3 questions once the last 20 first attempts are at least 80% correct", () => {
    for (let s = 1; s < 30; s++) {
      const r = selectLessonQuestions(pool(10), hist(17, 20), seeded(s));
      expect([2, 3]).toContain(r.questions.length);
    }
  });

  it("treats fewer than 5 answers as cold even when all are correct", () => {
    expect(lessonTarget([true, true, true], () => 0).mode).toBe("high-volume");
    expect(lessonTarget([true, true, true, true, true], () => 0).mode).toBe("reduced");
  });

  it("stays high-volume below 80% accuracy", () => {
    expect(lessonTarget(hist(15, 20), () => 0).mode).toBe("high-volume");
  });

  it("only looks at the most recent 20 first attempts", () => {
    const old = Array(30).fill(false);
    expect(lessonTarget([...old, ...hist(20, 20)], () => 0).mode).toBe("reduced");
  });

  it("caps the lesson at the unmastered pool size", () => {
    expect(selectLessonQuestions(pool(2), [], seeded(3)).questions).toHaveLength(2);
  });

  it("returns an empty, mastered lesson when nothing is left", () => {
    const r = selectLessonQuestions(pool(0), [], seeded(3));
    expect(r.questions).toEqual([]);
    expect(r.mastered).toBe(true);
  });

  it("is deterministic for a fixed RNG", () => {
    const a = selectLessonQuestions(pool(10), [], seeded(7)).questions.map((q) => q.id);
    const b = selectLessonQuestions(pool(10), [], seeded(7)).questions.map((q) => q.id);
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(a.length);
  });
});
