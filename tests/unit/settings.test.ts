import { beforeEach, describe, expect, it } from "vitest";
import { exportUserData, resetMastery, resetProgress, setGateMode, updateAccount } from "@/server/services/settings";
import { db, resetAndSeed, userId } from "./helpers/db";

describe("settings", () => {
  beforeEach(async () => {
    await resetAndSeed();
  });

  it("rejects a blank first name and accepts a rename", async () => {
    const david = await userId("davidsathyandevice");
    await expect(updateAccount(db, david, { firstName: " ", lastName: "Sathyan", email: "davidsathyandevice@gmail.com" })).rejects.toThrow("First name is required");
    await updateAccount(db, david, { firstName: "Dave", lastName: "Sathyan", email: "davidsathyandevice@gmail.com" });
    expect((await db.user.findUniqueOrThrow({ where: { id: david } })).firstName).toBe("Dave");
  });

  it("refuses an email another user owns", async () => {
    await expect(updateAccount(db, await userId("davidsathyandevice"), { firstName: "D", lastName: "S", email: "roy.c@lowercase.test" })).rejects.toThrow(/in use/);
  });

  it("validates gate modes", async () => {
    const david = await userId("davidsathyandevice");
    await setGateMode(db, david, "forceUnlocked");
    expect((await db.user.findUniqueOrThrow({ where: { id: david } })).gateMode).toBe("forceUnlocked");
    await expect(setGateMode(db, david, "nope")).rejects.toThrow();
  });

  it("reset mastery makes mastered questions selectable again", async () => {
    const roy = await userId("roy");
    const q = await db.question.findFirstOrThrow();
    await db.questionMastery.create({ data: { userId: roy, questionId: q.id } });
    await resetMastery(db, roy);
    expect(await db.questionMastery.count({ where: { userId: roy } })).toBe(0);
  });

  it("reset progress restores the seeded XP and streak", async () => {
    const david = await userId("davidsathyandevice");
    await db.user.update({ where: { id: david }, data: { xp: 9999, gateMode: "forceUnlocked" } });
    await db.dailyActivity.deleteMany({ where: { userId: david } });
    await resetProgress(db, david);
    const u = await db.user.findUniqueOrThrow({ where: { id: david } });
    expect([u.xp, u.gateMode]).toEqual([220, "auto"]);
    expect(await db.dailyActivity.count({ where: { userId: david } })).toBe(3);
  });

  it("exports only the user's own notepads", async () => {
    const [david, roy] = [await userId("davidsathyandevice"), await userId("roy")];
    const s = await db.caseSession.create({ data: { hostId: david, guestId: roy } });
    await db.sessionNote.create({ data: { sessionId: s.id, round: 1, userId: roy, content: "roy's secret" } });
    await db.sessionNote.create({ data: { sessionId: s.id, round: 2, userId: david, content: "david's own notes" } });
    const out = await exportUserData(db, david);
    expect(out.profile.username).toBe("davidsathyandevice");
    expect(out.notepads.map((n) => n.content)).toEqual(["david's own notes"]);
    expect(JSON.stringify(out)).not.toContain("roy's secret");
  });

  it("resetting my progress keeps my partner's results and unlocks", async () => {
    const [david, roy] = [await userId("davidsathyandevice"), await userId("roy")];
    await db.caseResult.createMany({
      data: [
        { caseType: "Profitability", difficulty: 1, intervieweeId: roy, interviewerId: david, avgScore: 4.5 },
        { caseType: "Pricing", difficulty: 1, intervieweeId: david, interviewerId: roy, avgScore: 4 },
      ],
    });
    await resetProgress(db, david);
    const left = await db.caseResult.findMany();
    expect(left).toHaveLength(1);
    expect(left[0]).toMatchObject({ intervieweeId: roy, interviewerId: null, avgScore: 4.5 });
  });
});
