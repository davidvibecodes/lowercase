"use server";

import { revalidatePath } from "next/cache";
import { createActionRunner } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { announceNewFriends, notifySocialChanged } from "@/server/realtime/social";
import * as social from "@/server/services/social";

// The layout carries the Received badge; revalidating it covers /friends too.
const runAction = createActionRunner(() => revalidatePath("/", "layout"));

async function run<T extends object>(fn: (me: string) => Promise<T | void>) {
  const user = await requireUser();
  return runAction(() => fn(user.id));
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
