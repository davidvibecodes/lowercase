"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { resetConceptMastery } from "@/server/services/learn";
import { getUserProgress, recordLessonCompletion } from "@/server/services/progress";

const answersSchema = z.array(z.object({ questionId: z.string(), attempts: z.array(z.string()), revealed: z.boolean() })).min(1);

export type CompleteLessonResult =
  | { ok: true; xpEarned: number; firstTryCorrect: number; total: number; totalXp: number; streak: number }
  | { ok: false; error: string };

/** Commits a finished lesson; correctness is recomputed server-side (U8). */
export async function completeLessonAction(conceptId: string, answers: unknown): Promise<CompleteLessonResult> {
  const user = await requireUser();
  const parsed = answersSchema.safeParse(answers);
  if (!parsed.success) return { ok: false, error: "Invalid lesson data" };
  try {
    const r = await recordLessonCompletion(db, user.id, conceptId, parsed.data);
    const p = await getUserProgress(db, user.id);
    return { ok: true, xpEarned: r.xp, firstTryCorrect: r.firstTryCorrect, total: r.total, totalXp: p.xp, streak: p.streak };
  } catch {
    return { ok: false, error: "Couldn't save your lesson" };
  }
}

export async function resetConceptMasteryAction(conceptId: string, slug: string) {
  const user = await requireUser();
  await resetConceptMastery(db, user.id, conceptId);
  revalidatePath(`/learn/${slug}`);
}
