"use server";

import { revalidatePath } from "next/cache";
import { createActionRunner, type ActionResult } from "@/lib/action-result";
import { assertAdmin, requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import * as settings from "@/server/services/settings";

export type SettingsResult = ActionResult;

const runAction = createActionRunner(() => revalidatePath("/", "layout"));

// Settings actions only report success or failure: whatever the service returns is dropped.
const run = (fn: () => Promise<unknown>) =>
  runAction(async () => {
    await fn();
  });

export async function updateAccountAction(input: { firstName: string; lastName: string }) {
  const u = await requireUser();
  return run(() => settings.updateAccount(db, u.id, input));
}

export async function updatePreferencesAction(prefs: { soundOn?: boolean; reducedMotion?: boolean }) {
  const u = await requireUser();
  return run(() => settings.updatePreferences(db, u.id, prefs));
}

export async function setGateModeAction(mode: string) {
  return run(async () => {
    const u = await assertAdmin();
    await settings.setGateMode(db, u.id, mode);
  });
}

export async function resetMasteryAction() {
  const u = await requireUser();
  return run(() => settings.resetMastery(db, u.id));
}

export async function resetProgressAction() {
  const u = await requireUser();
  return run(() => settings.resetProgress(db, u.id));
}
