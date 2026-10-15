import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { sessionValueFromCookieHeader, verifySessionValue } from "@/lib/auth/session-cookie";
import { db } from "@/lib/db";
import { registerInviteHandlers } from "./invites";
import { addSocket, isOnline, removeSocket } from "./presence";
import { registerSessionHandlers, onUserDisconnected } from "./session";
import { userRoom, type IO } from "./types";

async function friendIds(userId: string): Promise<string[]> {
  const rows = await db.friendship.findMany({ where: { userId }, select: { friendId: true } });
  return rows.map((r) => r.friendId);
}

/** Attaches Socket.IO to the shared HTTP server (KTD1, KTD2). */
export function attachRealtime(httpServer: HttpServer): IO {
  const io: IO = new Server(httpServer, {
    // Leave Next's dev HMR websocket upgrades alone.
    destroyUpgrade: false,
    serveClient: false,
    pingInterval: 10_000,
    pingTimeout: 8_000,
  });

  io.use(async (socket, next) => {
    const userId = verifySessionValue(sessionValueFromCookieHeader(socket.handshake.headers.cookie));
    if (!userId) return next(new Error("unauthorized"));
    const exists = await db.user.count({ where: { id: userId } });
    if (!exists) return next(new Error("unauthorized"));
    socket.data.userId = userId;
    next();
  });

  io.on("connection", async (socket) => {
    const me = socket.data.userId;
    socket.join(userRoom(me));
    registerInviteHandlers(io, socket);
    registerSessionHandlers(io, socket);

    const wentOnline = addSocket(me, socket.id);
    const friends = await friendIds(me);
    socket.emit("presence:snapshot", friends.filter(isOnline));
    if (wentOnline) for (const f of friends) io.to(userRoom(f)).emit("presence:update", { userId: me, online: true });

    socket.on("disconnect", async () => {
      const wentOffline = removeSocket(me, socket.id);
      if (wentOffline) {
        for (const f of await friendIds(me)) io.to(userRoom(f)).emit("presence:update", { userId: me, online: false });
      }
      await onUserDisconnected(io, me);
    });
  });

  return io;
}
