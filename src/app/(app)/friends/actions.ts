"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { announceNewFriends, notifySocialChanged } from "@/server/realtime/social";
import { ServiceError } from "@/server/services/invites";
import * as social from "@/server/services/social";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const fail = (e: unknown): Result => ({ ok: false, error: e instanceof ServiceError ? e.message : "Something went wrong" });

async function run<T extends object>(fn: (me: string) => Promise<T | void>): Promise<Result<T>> {
  const user = await requireUser();
  try {
    const out = (await fn(user.id)) ?? ({} as T);
    revalidatePath("/friends");
    revalidatePath("/", "layout");
    return { ok: true, ...out };
  } catch (e) {
    return fail(e) as Result<T>;
  }
}

export async function searchPeopleAction(query: string) {
  const user = await requireUser();
  return social.searchPeople(db, user.id, query);
}

export async function searchGroupsAction(query: string) {
  const user = await requireUser();
  return social.searchGroups(db, user.id, query);
}

export async function sendFriendRequestAction(username: string) {
  return run(async (me) => {
    const r = await social.sendFriendRequest(db, me, username);
    await notifySocialChanged(db, [me, r.otherId]);
    if (r.status === "accepted") announceNewFriends(me, r.otherId);
    return { status: r.status };
  });
}

export async function respondFriendRequestAction(requestId: string, accept: boolean) {
  return run(async (me) => {
    const from = await social.respondToFriendRequest(db, me, requestId, accept);
    await notifySocialChanged(db, [me, from]);
    if (accept) announceNewFriends(me, from);
  });
}

export async function cancelFriendRequestAction(requestId: string) {
  return run(async (me) => {
    const to = await social.cancelFriendRequest(db, me, requestId);
    await notifySocialChanged(db, [me, to]);
  });
}

export async function createGroupAction(name: string, friendIds: string[]) {
  return run(async (me) => {
    const { invitedIds } = await social.createGroup(db, me, name, friendIds);
    await notifySocialChanged(db, [me, ...invitedIds]);
  });
}

export async function respondGroupInviteAction(inviteId: string, accept: boolean) {
  return run(async (me) => {
    const from = await social.respondToGroupInvite(db, me, inviteId, accept);
    await notifySocialChanged(db, [me, from]);
  });
}

export async function cancelGroupInviteAction(inviteId: string) {
  return run(async (me) => {
    const to = await social.cancelGroupInvite(db, me, inviteId);
    await notifySocialChanged(db, [me, to]);
  });
}

export async function joinGroupAction(groupId: string) {
  return run(async (me) => {
    const inviters = await social.joinGroup(db, me, groupId);
    await notifySocialChanged(db, [me, ...inviters]);
  });
}

export async function leaveGroupAction(groupId: string) {
  return run((me) => social.leaveGroup(db, me, groupId));
}
