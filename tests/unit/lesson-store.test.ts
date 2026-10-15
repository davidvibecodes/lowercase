import { beforeEach, describe, expect, it } from "vitest";
import { lessonAnswers, useLesson, type LessonQuestion } from "@/stores/lesson";

const q = (id: string): LessonQuestion => ({
  id,
  kind: "concept",
  prompt: `Prompt ${id}`,
  scenario: null,
  explanation: "Because.",
  options: [
    { id: `${id}-a`, text: "Right", isCorrect: true },
    { id: `${id}-b`, text: "Wrong", isCorrect: false },
  ],
});

const L = () => useLesson.getState();

describe("lesson store", () => {
  beforeEach(() => {
    L().start({ explainerCount: 2, questions: [q("1"), q("2")] });
  });

  it("walks explainers before questions", () => {
    expect(L().phase).toBe("explainers");
    L().nextExplainer();
    expect(L().explainerIndex).toBe(1);
    L().nextExplainer();
    expect(L().phase).toBe("questions");
  });

  it("does nothing on Check until an option is selected", () => {
    L().nextExplainer();
    L().nextExplainer();
    expect(L().check()).toBeNull();
    expect(L().states[0].attempts).toEqual([]);
  });

  it("awards 15 XP for a first-try correct answer", () => {
    L().nextExplainer();
    L().nextExplainer();
    L().select("1-a");
    expect(L().check()).toBe("correct");
    expect(L().pendingXp).toBe(15);
  });

  it("gives no XP for a correct answer after Try Again, but still records both attempts", () => {
    L().nextExplainer();
    L().nextExplainer();
    L().select("1-b");
    expect(L().check()).toBe("incorrect");
    L().tryAgain();
    expect(L().states[0].status).toBe("idle");
    L().select("1-a");
    expect(L().check()).toBe("correct");
    expect(L().pendingXp).toBe(0);
    expect(L().states[0].attempts).toEqual(["1-b", "1-a"]);
  });

  it("See Answer marks the correct option and allows Continue without mastering", () => {
    L().nextExplainer();
    L().nextExplainer();
    L().select("1-b");
    L().check();
    L().seeAnswer();
    expect(L().states[0]).toMatchObject({ status: "revealed", revealed: true, selected: "1-a" });
    L().next();
    expect(L().questionIndex).toBe(1);
    expect(lessonAnswers()[0]).toEqual({ questionId: "1", attempts: ["1-b"], revealed: true });
  });

  it("blocks Continue until the question is resolved, then completes after the last one", () => {
    L().nextExplainer();
    L().nextExplainer();
    L().next();
    expect(L().questionIndex).toBe(0);
    L().select("1-a");
    L().check();
    L().next();
    L().select("2-a");
    L().check();
    L().next();
    expect(L().phase).toBe("complete");
  });

  it("reset discards all progress (quit)", () => {
    L().nextExplainer();
    L().nextExplainer();
    L().select("1-a");
    L().check();
    L().reset();
    expect(L().pendingXp).toBe(0);
    expect(L().questions).toEqual([]);
  });
});
