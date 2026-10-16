import type { Db } from "@/lib/db";
import { receivedCount } from "@/server/services/social";
import { getIo } from "./io-handle";
import { isOnline } from "./presence";
import { userRoom } from "./types";

/** Tells each user their fresh Received count (R18); call only after the change committed (KTD9). */
export async function notifySocialChanged(db: Db, userIds: string[]) {
  const io = getIo();
  if (!io) return;
  for (const id of new Set(userIds)) io.to(userRoom(id)).emit("social:changed", { received: await receivedCount(db, id) });
}

/** New friends see each other's presence without a reload (R22). Only on accept: a pending request reveals nothing. */
export function announceNewFriends(a: string, b: string) {
  const io = getIo();
  if (!io) return;
  if (isOnline(b)) io.to(userRoom(a)).emit("presence:update", { userId: b, online: true });
  if (isOnline(a)) io.to(userRoom(b)).emit("presence:update", { userId: a, online: true });
}
