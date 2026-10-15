import { db } from "@/lib/db";
import { acceptInvite, cancelInvite, declineInvite, expireInvite, person, sendInvite } from "@/server/services/invites";
import { isOnline } from "./presence";
import { errorMessage, userRoom, type IO, type IOSocket } from "./types";

/** Unanswered invites expire after this long (overridable for tests). */
export function inviteTtlMs() {
  return Number(process.env.INVITE_TTL_MS ?? 120_000);
}

export function registerInviteHandlers(io: IO, socket: IOSocket) {
  const me = socket.data.userId;

  socket.on("invite:send", async (p, ack) => {
    try {
      const invite = await sendInvite(db, me, p, isOnline);
      io.to(userRoom(invite.toId)).emit("invite:received", {
        inviteId: invite.id,
        sessionId: invite.sessionId,
        from: invite.from,
        caseType: invite.session.caseType,
        difficulty: invite.session.difficulty,
      });
      setTimeout(async () => {
        const expired = await expireInvite(db, invite.id).catch(() => null);
        if (!expired) return;
        const payload = { inviteId: invite.id, status: "EXPIRED" as const, by: null };
        io.to(userRoom(expired.toId)).to(userRoom(expired.fromId)).emit("invite:closed", payload);
      }, inviteTtlMs()).unref?.();
      ack({ ok: true, inviteId: invite.id, sessionId: invite.sessionId });
    } catch (err) {
      ack({ ok: false, error: errorMessage(err) });
    }
  });

  socket.on("invite:cancel", async ({ inviteId }, ack) => {
    try {
      const toId = await cancelInvite(db, inviteId, me);
      if (toId) io.to(userRoom(toId)).emit("invite:closed", { inviteId, status: "CANCELLED", by: await person(db, me) });
      ack({ ok: true });
    } catch (err) {
      ack({ ok: false, error: errorMessage(err) });
    }
  });

  socket.on("invite:decline", async ({ inviteId }, ack) => {
    try {
      const fromId = await declineInvite(db, inviteId, me);
      if (fromId) io.to(userRoom(fromId)).emit("invite:closed", { inviteId, status: "DECLINED", by: await person(db, me) });
      ack({ ok: true });
    } catch (err) {
      ack({ ok: false, error: errorMessage(err) });
    }
  });

  socket.on("invite:accept", async ({ inviteId }, ack) => {
    try {
      const { sessionId, fromId } = await acceptInvite(db, inviteId, me);
      const by = await person(db, me);
      io.to(userRoom(fromId)).emit("invite:closed", { inviteId, status: "ACCEPTED", by });
      io.to(userRoom(fromId)).to(userRoom(me)).emit("session:ready", { sessionId });
      ack({ ok: true, sessionId });
    } catch (err) {
      ack({ ok: false, error: errorMessage(err) });
    }
  });
}
