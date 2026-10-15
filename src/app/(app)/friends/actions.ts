"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { ServiceError } from "@/server/services/invites";
import { addFriend, createGroup, joinGroup, search } from "@/server/services/social";

type Result = { ok: true } | { ok: false; error: string };

const fail = (e: unknown): Result => ({ ok: false, error: e instanceof ServiceError ? e.message : "Something went wrong" });

export async function searchAction(query: string) {
  const user = await requireUser();
  return search(db, user.id, query);
}

export async function addFriendAction(friendId: string): Promise<Result> {
  const user = await requireUser();
  try {
    await addFriend(db, user.id, friendId);
    revalidatePath("/friends");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function createGroupAction(name: string, memberIds: string[]): Promise<Result> {
  const user = await requireUser();
  try {
    await createGroup(db, user.id, name, memberIds);
    revalidatePath("/friends");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function joinGroupAction(groupId: string): Promise<Result> {
  const user = await requireUser();
  await joinGroup(db, user.id, groupId);
  revalidatePath("/friends");
  return { ok: true };
}
