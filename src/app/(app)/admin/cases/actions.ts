"use server";

import { revalidatePath } from "next/cache";
import { createActionRunner, type ActionResult } from "@/lib/action-result";
import { assertAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import * as admin from "@/server/services/admin-cases";

export type CaseResult<T = object> = ActionResult<T>;

const runAction = createActionRunner(() => revalidatePath("/admin/cases", "layout"));

// Inside the runner's try: a ServiceError("Not authorized") becomes { ok: false } (R13).
const run = <T extends object>(fn: () => Promise<T | void>) =>
  runAction(async () => {
    await assertAdmin();
    return fn();
  });

export const createCaseAction = async (input: unknown) => run(async () => ({ id: (await admin.createCase(db, input)).id }));
export const updateCaseMetaAction = async (id: string, input: unknown) => run(() => admin.updateCaseMeta(db, id, input));
export const saveCaseItemsAction = async (id: string, kind: string, items: unknown) => run(async () => ({ items: await admin.saveCaseItems(db, id, kind, items) }));
export const saveTranscriptAction = async (id: string, turns: unknown) => run(() => admin.saveTranscript(db, id, turns));
export const saveTreeAction = async (id: string, nodes: unknown) => run(async () => ({ warnings: await admin.saveTree(db, id, nodes) }));
export const deleteCaseAction = async (id: string) => run(() => admin.deleteCase(db, id));
