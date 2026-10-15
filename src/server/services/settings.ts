import { z } from "zod";
import type { Db } from "@/lib/db";
import { GATE_MODES, type GateMode } from "@/lib/types";
import { resetUserProgress } from "@/server/seed-runner";
import { parseInput, ServiceError } from "./invites";

export const accountInput = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(40),
  lastName: z.string().trim().min(1, "Last name is required").max(40),
  email: z.string().trim().email("Enter a valid email"),
});

export async function updateAccount(db: Db, userId: string, input: unknown) {
  const data = parseInput(accountInput, input);
  const clash = await db.user.findFirst({ where: { email: data.email, id: { not: userId } } });
  if (clash) throw new ServiceError("That email is already in use");
  await db.user.update({ where: { id: userId }, data });
}

export async function updatePreferences(db: Db, userId: string, prefs: { soundOn?: boolean; reducedMotion?: boolean }) {
  await db.user.update({ where: { id: userId }, data: { soundOn: prefs.soundOn, reducedMotion: prefs.reducedMotion } });
}

export async function setGateMode(db: Db, userId: string, mode: string) {
  if (!GATE_MODES.includes(mode as GateMode)) throw new ServiceError("Unknown gate mode");
  await db.user.update({ where: { id: userId }, data: { gateMode: mode } });
}

export async function resetMastery(db: Db, userId: string) {
  await db.questionMastery.deleteMany({ where: { userId } });
}

export async function resetProgress(db: Db, userId: string) {
  await resetUserProgress(db, userId);
}

/** The user's own data only; other people's notes never leave. */
export async function exportUserData(db: Db, userId: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const [mastery, answers, lessons, activity, results, notes, friends, groups] = await Promise.all([
    db.questionMastery.findMany({ where: { userId } }),
    db.answerEvent.findMany({ where: { userId } }),
    db.lessonCompletion.findMany({ where: { userId } }),
    db.dailyActivity.findMany({ where: { userId } }),
    db.caseResult.findMany({ where: { OR: [{ intervieweeId: userId }, { interviewerId: userId }] } }),
    db.sessionNote.findMany({ where: { userId } }),
    db.friendship.findMany({ where: { userId }, select: { friend: { select: { username: true, firstName: true, lastName: true } } } }),
    db.groupMember.findMany({ where: { userId }, select: { group: { select: { name: true } } } }),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    profile: { username: user.username, firstName: user.firstName, lastName: user.lastName, email: user.email, xp: user.xp, gateMode: user.gateMode },
    mastery,
    answers,
    lessons,
    activity,
    caseResults: results,
    notepads: notes,
    friends: friends.map((f) => f.friend),
    groups: groups.map((g) => g.group.name),
  };
}
