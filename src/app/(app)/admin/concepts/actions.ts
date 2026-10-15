"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import * as admin from "@/server/services/admin-content";
import { ServiceError } from "@/server/services/invites";

export type AdminResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function run<T extends object>(fn: () => Promise<T | void>): Promise<AdminResult<T>> {
  await assertAdmin();
  try {
    const out = (await fn()) ?? ({} as T);
    revalidatePath("/", "layout");
    return { ok: true, ...out };
  } catch (e) {
    return { ok: false, error: e instanceof ServiceError ? e.message : "Something went wrong" };
  }
}

export const createConceptAction = async (input: unknown) => run(async () => ({ id: (await admin.createConcept(db, input)).id }));
export const updateConceptAction = async (id: string, input: unknown) => run(async () => void (await admin.updateConcept(db, id, input)));
export const moveConceptAction = async (id: string, dir: -1 | 1) => run(() => admin.moveConcept(db, id, dir));
export const publishConceptAction = async (id: string, published: boolean) => run(() => admin.setConceptPublished(db, id, published));
export const deleteConceptAction = async (id: string) => run(() => admin.deleteConcept(db, id));
export const saveExplainersAction = async (conceptId: string, list: unknown) => run(() => admin.saveExplainers(db, conceptId, list));
export const saveQuestionAction = async (conceptId: string, questionId: string | null, input: unknown) =>
  run(async () => ({ id: await admin.saveQuestion(db, conceptId, questionId, input) }));
export const deleteQuestionAction = async (questionId: string) => run(() => admin.deleteQuestion(db, questionId));
export const resetConceptMasteryAction = async (conceptId: string) => run(async () => ({ count: await admin.resetConceptMasteryForAll(db, conceptId) }));
