import { db } from "@/lib/db";
import type { Ack } from "@/lib/realtime/events";
import { person } from "@/server/services/invites";
import * as sessions from "@/server/services/sessions";
import { errorMessage, sessionRoom, type IO, type IOSocket } from "./types";

/** Who has a socket in the session room right now. */
async function connectedIn(io: IO, sessionId: string): Promise<Set<string>> {
  const sockets = await io.in(sessionRoom(sessionId)).fetchSockets();
  return new Set(sockets.map((s) => s.data.userId));
}

/**
 * Per-session broadcast queue. Snapshots are built and sent one at a time, and
 * requests arriving mid-flight coalesce into one more pass, so a slower, older
 * snapshot can never land after a newer one.
 */
const queues = new Map<string, { running: Promise<void>; again: boolean }>();

export function broadcastSession(io: IO, sessionId: string): Promise<void> {
  const q = queues.get(sessionId);
  if (q) {
    q.again = true;
    return q.running;
  }
  const entry = { running: Promise.resolve(), again: false };
  entry.running = (async () => {
    do {
      entry.again = false;
      await sendViews(io, sessionId);
    } while (entry.again);
    queues.delete(sessionId);
  })();
  queues.set(sessionId, entry);
  return entry.running;
}

/** Sends each socket in the room its own role-specific projection (KTD2). */
async function sendViews(io: IO, sessionId: string) {
  const sockets = await io.in(sessionRoom(sessionId)).fetchSockets();
  const connected = new Set(sockets.map((s) => s.data.userId));
  const views = new Map<string, Awaited<ReturnType<typeof sessions.buildView>>>();
  for (const s of sockets) {
    const uid = s.data.userId;
    if (!views.has(uid)) {
      try {
        views.set(uid, await sessions.buildView(db, sessionId, uid, connected));
      } catch {
        continue;
      }
    }
    s.emit("session:state", views.get(uid)!);
  }
}

function handle<P extends { sessionId: string }, R extends object = object>(
  io: IO,
  socket: IOSocket,
  run: (p: P, userId: string) => Promise<R | void>,
) {
  return async (p: P, ack: Ack<R>) => {
    try {
      const out = (await run(p, socket.data.userId)) ?? ({} as R);
      ack({ ok: true, ...out });
      await broadcastSession(io, p.sessionId);
    } catch (err) {
      ack({ ok: false, error: errorMessage(err) });
    }
  };
}

export function registerSessionHandlers(io: IO, socket: IOSocket) {
  socket.on("session:join", async ({ sessionId }, ack) => {
    try {
      const s = await db.caseSession.findUnique({ where: { id: sessionId } });
      if (!s || !sessions.isParticipant(s, socket.data.userId)) throw new Error("This session is private");
      await socket.join(sessionRoom(sessionId));
      const view = await sessions.buildView(db, sessionId, socket.data.userId, await connectedIn(io, sessionId));
      ack({ ok: true, view });
      await broadcastSession(io, sessionId);
    } catch (err) {
      ack({ ok: false, error: errorMessage(err) });
    }
  });

  socket.on("session:pickRole", handle(io, socket, (p: { sessionId: string; role: "interviewer" | "interviewee" }, uid) => sessions.pickRole(db, p.sessionId, uid, p.role)));
  socket.on(
    "session:setCaseFilter",
    handle(io, socket, (p: { sessionId: string; caseType: string; difficulty: number }, uid) => sessions.setCaseFilter(db, p.sessionId, uid, p.caseType, p.difficulty)),
  );
  socket.on("session:selectCase", handle(io, socket, (p: { sessionId: string; caseId: string }, uid) => sessions.selectCase(db, p.sessionId, uid, p.caseId)));
  socket.on("session:ready", handle(io, socket, (p: { sessionId: string; ready: boolean }, uid) => sessions.setReady(db, p.sessionId, uid, p.ready)));
  socket.on("session:reveal", handle(io, socket, (p: { sessionId: string; factId: string }, uid) => sessions.revealFact(db, p.sessionId, uid, p.factId)));
  socket.on("session:hint", handle(io, socket, async (p: { sessionId: string }, uid) => ({ hint: await sessions.useHint(db, p.sessionId, uid) })));
  socket.on(
    "session:solve",
    handle(io, socket, (p: { sessionId: string; scores: Array<{ criterion: string; score: number; notes: string }> }, uid) => sessions.solveCase(db, p.sessionId, uid, p.scores)),
  );
  socket.on("session:switchRoles", handle(io, socket, (p: { sessionId: string }, uid) => sessions.nextRound(db, p.sessionId, uid, "switchRoles")));
  socket.on("session:newCase", handle(io, socket, (p: { sessionId: string }, uid) => sessions.nextRound(db, p.sessionId, uid, "newCase")));

  // Notepad saves only echo to the writer's own sockets; nothing else changes.
  socket.on("session:notepad", async ({ sessionId, content }, ack) => {
    try {
      await sessions.saveNotepad(db, sessionId, socket.data.userId, content);
      ack({ ok: true });
      const mine = (await io.in(sessionRoom(sessionId)).fetchSockets()).filter((s) => s.data.userId === socket.data.userId && s.id !== socket.id);
      const round = (await db.caseSession.findUniqueOrThrow({ where: { id: sessionId } })).round;
      for (const s of mine) s.emit("notepad:sync", { sessionId, round, content });
    } catch (err) {
      ack({ ok: false, error: errorMessage(err) });
    }
  });

  socket.on("session:close", async ({ sessionId }, ack) => {
    try {
      const closed = await sessions.closeSession(db, sessionId, socket.data.userId);
      ack({ ok: true });
      if (closed) io.to(sessionRoom(sessionId)).emit("session:closed", { sessionId, by: await person(db, socket.data.userId) });
      io.in(sessionRoom(sessionId)).socketsLeave(sessionRoom(sessionId));
    } catch (err) {
      ack({ ok: false, error: errorMessage(err) });
    }
  });
}

/** Partner sees "reconnecting" when a player's last socket leaves the room. */
export async function onUserDisconnected(io: IO, userId: string) {
  for (const s of await sessions.openSessionsFor(db, userId)) await broadcastSession(io, s.id);
}
