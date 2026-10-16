import type { Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Server } from "socket.io";
import { sessionValueFromCookieHeader, verifySessionValue } from "@/lib/auth/session-cookie";
import { db } from "@/lib/db";
import { isAllowedHost, isAllowedOrigin } from "@/server/loopback";
import { registerInviteHandlers } from "./invites";
import { setIo } from "./io-handle";
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
    // Socket.IO handles its own requests before server.ts sees them, so it checks Host and Origin itself (KTD16).
    allowRequest: (req, cb) => {
      const port = (httpServer.address() as AddressInfo | null)?.port ?? process.env.PORT ?? 3000;
      cb(null, isAllowedHost(req.headers.host, port) && isAllowedOrigin(req.headers.origin, port));
    },
  });

  setIo(io);

  io.use(async (socket, next) => {
    const session = verifySessionValue(sessionValueFromCookieHeader(socket.handshake.headers.cookie));
    if (!session) return next(new Error("unauthorized"));
    const user = await db.user.findUnique({ where: { id: session.userId }, select: { username: true } });
    if (!user) return next(new Error("unauthorized"));
    // R7: nobody reaches presence or sessions before choosing a username.
    if (!user.username) return next(new Error("onboarding_required"));
    socket.data.userId = session.userId;
    socket.data.method = session.method;
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
