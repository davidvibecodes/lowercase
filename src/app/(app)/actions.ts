"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { isLevelUnlocked } from "@/lib/rules/gates";
import { isCaseType, isDifficulty } from "@/lib/types";
import { getGateResults } from "@/server/services/progress";

/** Track 2: open a lobby with a type/level preselection, no warm-up (R9). */
export async function createLobbyAction(caseType: string, difficulty: number) {
  const user = await requireUser();
  if (!isCaseType(caseType) || !isDifficulty(difficulty)) throw new Error("Invalid selection");
  const me = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!isLevelUnlocked(await getGateResults(db, user.id), caseType, difficulty, me.gateMode)) throw new Error("That level is locked");
  const session = await db.caseSession.create({ data: { hostId: user.id, caseType, difficulty } });
  redirect(`/session/${session.id}`);
}
