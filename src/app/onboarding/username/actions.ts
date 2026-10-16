"use server";

import { redirect } from "next/navigation";
import { requireSignedIn } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { claimUsername } from "@/server/services/username";

export type ClaimState = { error?: string };

export async function claimUsernameAction(_prev: ClaimState, formData: FormData): Promise<ClaimState> {
  const user = await requireSignedIn();
  const r = await claimUsername(db, user.id, String(formData.get("username") ?? ""));
  if (!r.ok) return { error: r.error };
  redirect("/");
}
