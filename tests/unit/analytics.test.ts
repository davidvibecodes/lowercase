import { beforeEach, describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import { getAnalytics } from "@/server/services/analytics";
import { db, resetAndSeed, userId } from "./helpers/db";

// Thursday 2026-10-15, noon.
const now = new Date(2026, 9, 15, 12);

async function answers(user: string, conceptId: string, questionId: string, list: Array<[boolean, Date]>) {
  await db.answerEvent.createMany({ data: list.map(([firstAttemptCorrect, createdAt]) => ({ userId: user, conceptId, questionId, firstAttemptCorrect, createdAt })) });
}

describe("analytics", () => {
  let ankit: string;
  let conceptId: string;
  let questionId: string;
  beforeEach(async () => {
    await resetAndSeed(now);
    ankit = await userId("ankit");
    const q = await db.question.findFirstOrThrow();
    conceptId = q.conceptId;
    questionId = q.id;
  });

  it("computes this week's first-attempt accuracy and keeps older answers for All time", async () => {
    await answers(ankit, conceptId, questionId, [
      [true, now],
      [true, addDays(now, -1)],
      [true, addDays(now, -2)],
      [false, addDays(now, -3)],
      [false, addDays(now, -40)],
    ]);
    expect((await getAnalytics(db, ankit, "week", now)).accuracy).toBeCloseTo(0.75);
    const all = await getAnalytics(db, ankit, "all", now);
    expect(all.answered).toBe(5);
    expect(all.accuracy).toBeCloseTo(0.6);
  });

  it("counts a case solved as interviewer as an activity but not in the matrix", async () => {
    const david = await userId("davidsathyandevice");
    await db.caseResult.create({ data: { caseType: "Pricing", difficulty: 1, intervieweeId: david, interviewerId: ankit, avgScore: 4, solvedAt: now } });
    const a = await getAnalytics(db, ankit, "week", now);
    expect(a.activities).toBe(1);
    expect(a.matrix.flatMap((m) => m.cells).every((c) => c.count === 0)).toBe(true);
  });

  it("averages repeated results in a matrix cell", async () => {
    await db.caseResult.createMany({
      data: [
        { caseType: "Profitability", difficulty: 1, intervieweeId: ankit, avgScore: 4.5, solvedAt: now },
        { caseType: "Profitability", difficulty: 1, intervieweeId: ankit, avgScore: 3.5, solvedAt: now },
      ],
    });
    const cell = (await getAnalytics(db, ankit, "all", now)).matrix.find((m) => m.caseType === "Profitability")!.cells[0];
    expect(cell).toMatchObject({ count: 2, avgScore: 4, unlocked: true });
  });

  it("returns zeros and an empty chart for a user with no data", async () => {
    const a = await getAnalytics(db, await userId("aarav.m"), "month", now);
    expect(a.activities).toBe(0);
    expect(a.accuracy).toBeNull();
    expect(a.chart.every((b) => b.solved === 0)).toBe(true);
  });

  it("buckets the week Mon–Sun", async () => {
    await answers(ankit, conceptId, questionId, [[true, now]]);
    const chart = (await getAnalytics(db, ankit, "week", now)).chart;
    expect(chart.map((b) => b.label)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    expect(chart[3].solved).toBe(1);
  });
});
