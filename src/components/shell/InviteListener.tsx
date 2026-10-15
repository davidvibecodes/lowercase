"use client";

import { AnimatePresence, m } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Swords, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/components/ui/Toast";
import type { InvitePayload } from "@/lib/realtime/events";
import { emitAck, getSocket } from "@/lib/realtime/socket";
import { DIFFICULTY_LABEL, type Difficulty } from "@/lib/types";
import { useActivity } from "@/stores/activity";

/** Always-on: shows incoming invites on any page and follows session:ready (U5). */
export function InviteListener() {
  const router = useRouter();
  const [invites, setInvites] = useState<InvitePayload[]>([]);
  const [confirmJoin, setConfirmJoin] = useState<InvitePayload | null>(null);
  const lessonInProgress = useActivity((s) => s.lessonInProgress);
  const activeSessionId = useActivity((s) => s.activeSessionId);

  useEffect(() => {
    const s = getSocket();
    const onReceived = (p: InvitePayload) => setInvites((list) => [...list.filter((i) => i.inviteId !== p.inviteId), p]);
    const onClosed = (p: { inviteId: string; status: string; by: { firstName: string } | null }) => {
      setInvites((list) => list.filter((i) => i.inviteId !== p.inviteId));
      if (p.status === "DECLINED" && p.by) toast(`${p.by.firstName} declined your invite`, "warning");
      if (p.status === "CANCELLED" && p.by) toast(`${p.by.firstName} cancelled the invite`);
    };
    const onReady = ({ sessionId }: { sessionId: string }) => {
      useActivity.getState().setLessonInProgress(false);
      router.push(`/session/${sessionId}`);
    };
    s.on("invite:received", onReceived);
    s.on("invite:closed", onClosed);
    s.on("session:ready", onReady);
    return () => {
      s.off("invite:received", onReceived);
      s.off("invite:closed", onClosed);
      s.off("session:ready", onReady);
    };
  }, [router]);

  const accept = async (inv: InvitePayload) => {
    setConfirmJoin(null);
    const res = await emitAck("invite:accept", { inviteId: inv.inviteId });
    setInvites((list) => list.filter((i) => i.inviteId !== inv.inviteId));
    if (!res.ok) toast(res.error, "warning");
    // Navigation follows the session:ready event.
  };

  const decline = async (inv: InvitePayload) => {
    setInvites((list) => list.filter((i) => i.inviteId !== inv.inviteId));
    await emitAck("invite:decline", { inviteId: inv.inviteId });
  };

  const onJoin = (inv: InvitePayload) => (lessonInProgress ? setConfirmJoin(inv) : accept(inv));

  return (
    <>
      <div className="pointer-events-none fixed bottom-5 right-5 z-[55] flex w-[min(380px,calc(100vw-2.5rem))] flex-col gap-3" aria-live="assertive">
        <AnimatePresence>
          {invites.map((inv) => {
            const busy = Boolean(activeSessionId);
            return (
              <m.div
                key={inv.inviteId}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 40 }}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
                className="pointer-events-auto rounded-3xl border border-royal-bright/50 bg-surface p-4 shadow-[0_20px_60px_-20px_#1d4ed8aa]"
                role="alertdialog"
                aria-label={`Session invite from ${inv.from.firstName}`}
              >
                <div className="flex items-start gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-royal-soft text-royal-bright">
                    <Swords size={22} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold">
                      {inv.from.firstName} {inv.from.lastName} invited you to a case session
                    </p>
                    <p className="mt-0.5 text-sm text-muted">
                      {busy
                        ? "Finish your current session first."
                        : inv.caseType
                          ? `${inv.caseType}${inv.difficulty ? ` · ${DIFFICULTY_LABEL[inv.difficulty as Difficulty]}` : ""}`
                          : "Pick roles and a case together in the lobby."}
                    </p>
                  </div>
                  <button type="button" aria-label="Dismiss" onClick={() => decline(inv)} className="rounded-lg p-1 text-faint hover:text-ink">
                    <X size={18} />
                  </button>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" variant="success" className="flex-1" disabled={busy} onClick={() => onJoin(inv)}>
                    Join
                  </Button>
                  <Button size="sm" variant="secondary" className="flex-1" onClick={() => decline(inv)}>
                    Decline
                  </Button>
                </div>
              </m.div>
            );
          })}
        </AnimatePresence>
      </div>

      <Modal open={Boolean(confirmJoin)} onClose={() => setConfirmJoin(null)} title="Leave this lesson?">
        <p className="text-muted">Joining ends this lesson. You will lose your progress and XP.</p>
        <div className="mt-6 flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => setConfirmJoin(null)} data-autofocus>
            Keep learning
          </Button>
          <Button variant="warning" className="flex-1" onClick={() => confirmJoin && accept(confirmJoin)}>
            Leave and join
          </Button>
        </div>
      </Modal>
    </>
  );
}
