"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin, requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { ServiceError } from "@/server/services/invites";
import * as settings from "@/server/services/settings";

export type SettingsResult = { ok: true } | { ok: false; error: string };

async function run(fn: () => Promise<unknown>): Promise<SettingsResult> {
  try {
    await fn();
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof ServiceError ? e.message : "Something went wrong" };
  }
}

export async function updateAccountAction(input: { firstName: string; lastName: string; email: string }) {
  const u = await requireUser();
  return run(() => settings.updateAccount(db, u.id, input));
}

export async function updatePreferencesAction(prefs: { soundOn?: boolean; reducedMotion?: boolean }) {
  const u = await requireUser();
  return run(() => settings.updatePreferences(db, u.id, prefs));
}

export async function setGateModeAction(mode: string) {
  const u = await assertAdmin();
  return run(() => settings.setGateMode(db, u.id, mode));
}

export async function resetMasteryAction() {
  const u = await requireUser();
  return run(() => settings.resetMastery(db, u.id));
}

export async function resetProgressAction() {
  const u = await requireUser();
  return run(() => settings.resetProgress(db, u.id));
}
