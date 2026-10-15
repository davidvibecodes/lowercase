import { beforeEach, describe, expect, it } from "vitest";
import { dayKey } from "@/lib/dates";
import { getUserProgress, recordCaseSolved, recordLessonCompletion } from "@/server/services/progress";
import { db, resetAndSeed, userId } from "./helpers/db";

async function conceptWithQuestions(slug: string) {
  return db.concept.findUniqueOrThrow({ where: { slug }, include: { questions: { include: { options: true }, orderBy: { order: "asc" } } } });
}

const correctId = (q: { options: Array<{ id: string; isCorrect: boolean }> }) => q.options.find((o) => o.isCorrect)!.id;
const wrongId = (q: { options: Array<{ id: string; isCorrect: boolean }> }) => q.options.find((o) => !o.isCorrect)!.id;

describe("recordLessonCompletion", () => {
  beforeEach(async () => {
    await resetAndSeed();
  });

  it("awards XP for first-try correct only, masters every eventually-correct answer, and logs all attempts", async () => {
    const u = await userId("ankit");
    const c = await conceptWithQuestions("case-type-identification");
    const [q1, q2, q3, q4, q5] = c.questions;
    const xpBefore = (await db.user.findUniqueOrThrow({ where: { id: u } })).xp;

    const r = await recordLessonCompletion(db, u, c.id, [
      { questionId: q1.id, attempts: [correctId(q1)], revealed: false },
      { questionId: q2.id, attempts: [correctId(q2)], revealed: false },
      { questionId: q3.id, attempts: [correctId(q3)], revealed: false },
      { questionId: q4.id, attempts: [wrongId(q4), correctId(q4)], revealed: false },
      { questionId: q5.id, attempts: [wrongId(q5)], revealed: true },
    ]);

    expect(r.xp).toBe(45);
    expect((await db.user.findUniqueOrThrow({ where: { id: u } })).xp).toBe(xpBefore + 45);
    expect(await db.questionMastery.count({ where: { userId: u } })).toBe(4);
    const events = await db.answerEvent.findMany({ where: { userId: u } });
    expect(events).toHaveLength(5);
    expect(events.filter((e) => e.firstAttemptCorrect)).toHaveLength(3);
    const today = await db.dailyActivity.findUniqueOrThrow({ where: { userId_day: { userId: u, day: dayKey() } } });
    expect(today.xp).toBeGreaterThanOrEqual(45);
  });

  it("recomputes correctness from stored options, ignoring client claims", async () => {
    const u = await userId("ankit");
    const c = await conceptWithQuestions("vrio");
    const r = await recordLessonCompletion(
      db,
      u,
      c.id,
      c.questions.map((q) => ({ questionId: q.id, attempts: [wrongId(q)], revealed: true, claimedCorrect: true }) as never),
    );
    expect(r.xp).toBe(0);
    expect(await db.questionMastery.count({ where: { userId: u } })).toBe(0);
  });

  it("rejects questions from another concept", async () => {
    const u = await userId("ankit");
    const a = await conceptWithQuestions("vrio");
    const b = await conceptWithQuestions("porters-five-forces");
    await expect(recordLessonCompletion(db, u, a.id, [{ questionId: b.questions[0].id, attempts: [correctId(b.questions[0])], revealed: false }])).rejects.toThrow();
  });
});

describe("recordCaseSolved", () => {
  beforeEach(async () => {
    await resetAndSeed();
  });

  it("creates the interviewee's result and awards +50 / +30 XP with activity for both", async () => {
    const [david, roy] = [await userId("davidsathyandevice"), await userId("roy")];
    const c = await db.case.findFirstOrThrow({ where: { title: "Diagnostic Center – Mumbai" } });
    const s = await db.caseSession.create({ data: { hostId: david, guestId: roy, caseId: c.id, status: "ACTIVE", interviewerId: david, intervieweeId: roy } });
    const before = await db.user.findMany({ where: { id: { in: [david, roy] } } });

    const out = await recordCaseSolved(db, { sessionId: s.id, round: 1, caseId: c.id, caseType: c.caseType, difficulty: c.difficulty, interviewerId: david, intervieweeId: roy, avgScore: 4.5 });

    expect(out.xp).toEqual({ [roy]: 50, [david]: 30 });
    const result = await db.caseResult.findFirstOrThrow({ where: { sessionId: s.id } });
    expect(result).toMatchObject({ intervieweeId: roy, interviewerId: david, avgScore: 4.5, caseType: "Profitability", difficulty: 1 });
    const after = await db.user.findMany({ where: { id: { in: [david, roy] } } });
    const xpOf = (list: typeof before, id: string) => list.find((u) => u.id === id)!.xp;
    expect(xpOf(after, roy) - xpOf(before, roy)).toBe(50);
    expect(xpOf(after, david) - xpOf(before, david)).toBe(30);
    for (const id of [david, roy]) expect(await db.dailyActivity.count({ where: { userId: id, day: dayKey() } })).toBe(1);
  });
});

describe("getUserProgress", () => {
  it("reports the seeded owner's 3-day streak on seed day", async () => {
    await resetAndSeed();
    const p = await getUserProgress(db, await userId("davidsathyandevice"));
    expect(p.streak).toBe(3);
    expect(p.xp).toBe(220);
  });
});
