"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "@/components/ui/Toast";
import { emitAck, getSocket } from "@/lib/realtime/socket";

/** Sends one invite at a time and tracks its pending state (shared by home, friends and lobby). */
export function useInviteFriend() {
  const [pending, setPending] = useState<{ inviteId: string; toUserId: string } | null>(null);

  useEffect(() => {
    const s = getSocket();
    const onClosed = (p: { inviteId: string }) => setPending((cur) => (cur?.inviteId === p.inviteId ? null : cur));
    s.on("invite:closed", onClosed);
    return () => {
      s.off("invite:closed", onClosed);
    };
  }, []);

  const invite = useCallback(async (toUserId: string, name: string, extra: { sessionId?: string; caseType?: string; difficulty?: number } = {}) => {
    const res = await emitAck("invite:send", { toUserId, ...extra });
    if (!res.ok) {
      toast(res.error, "warning");
      return;
    }
    setPending({ inviteId: res.inviteId, toUserId });
    toast(`Invite sent to ${name}`, "success");
  }, []);

  const cancel = useCallback(async () => {
    if (!pending) return;
    await emitAck("invite:cancel", { inviteId: pending.inviteId });
    setPending(null);
  }, [pending]);

  return { pending, invite, cancel };
}
