"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import * as admin from "@/server/services/admin-cases";
import { ServiceError } from "@/server/services/invites";

export type CaseResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function run<T extends object>(fn: () => Promise<T | void>): Promise<CaseResult<T>> {
  await assertAdmin();
  try {
    const out = (await fn()) ?? ({} as T);
    revalidatePath("/admin/cases", "layout");
    return { ok: true, ...out };
  } catch (e) {
    return { ok: false, error: e instanceof ServiceError ? e.message : "Something went wrong" };
  }
}

export const createCaseAction = async (input: unknown) => run(async () => ({ id: (await admin.createCase(db, input)).id }));
export const updateCaseMetaAction = async (id: string, input: unknown) => run(() => admin.updateCaseMeta(db, id, input));
export const saveCaseItemsAction = async (id: string, kind: string, items: unknown) => run(async () => ({ items: await admin.saveCaseItems(db, id, kind, items) }));
export const saveTranscriptAction = async (id: string, turns: unknown) => run(() => admin.saveTranscript(db, id, turns));
export const saveTreeAction = async (id: string, nodes: unknown) => run(async () => ({ warnings: await admin.saveTree(db, id, nodes) }));
export const deleteCaseAction = async (id: string) => run(() => admin.deleteCase(db, id));
