"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "@/components/ui/Toast";
import type { SessionView } from "@/lib/realtime/events";
import { emitAck, getSocket } from "@/lib/realtime/socket";
import { useActivity } from "@/stores/activity";
import { useGamification } from "@/stores/gamification";
import { useSessionStore } from "@/stores/session";
import { CompletionDialog } from "./CompletionDialog";
import { IntervieweeView } from "./interviewee/IntervieweeView";
import { InterviewerView } from "./interviewer/InterviewerView";
import { Lobby, type FriendRef } from "./Lobby";
import { SessionHeader } from "./SessionHeader";

export function SessionClient({ sessionId, friends }: { sessionId: string; friends: FriendRef[] }) {
  const router = useRouter();
  const view = useSessionStore((s) => s.view);
  const error = useSessionStore((s) => s.error);

  useEffect(() => {
    const s = getSocket();
    const store = useSessionStore.getState();
    store.setView(null);
    const join = async () => {
      const res = await emitAck("session:join", { sessionId });
      if (res.ok) useSessionStore.getState().setView(res.view);
      else useSessionStore.getState().setError(res.error);
    };
    const onState = (v: SessionView) => v.id === sessionId && useSessionStore.getState().setView(v);
    const onClosed = (p: { sessionId: string; by: { id: string; firstName: string } | null }) => {
      if (p.sessionId !== sessionId) return;
      const mine = p.by?.id === useSessionStore.getState().view?.me.id;
      if (!mine && p.by) toast(`${p.by.firstName} ended the session`, "warning");
      router.push("/");
    };
    s.on("session:state", onState);
    s.on("session:closed", onClosed);
    s.on("connect", join); // rejoin the room after a reconnect
    if (s.connected) void join();
    return () => {
      s.off("session:state", onState);
      s.off("session:closed", onClosed);
      s.off("connect", join);
      useSessionStore.getState().setView(null);
      useActivity.getState().setActiveSession(null);
    };
  }, [sessionId, router]);

  // Busy flag for the global invite prompt; XP refresh after a solve.
  useEffect(() => {
    useActivity.getState().setActiveSession(view?.status === "ACTIVE" ? sessionId : null);
    if (view?.status === "SOLVED" && view.result) {
      const gained = view.result.xp[view.me.id] ?? 0;
      const key = `solved:${sessionId}:${view.round}`;
      if (gained && !sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        useGamification.getState().addXp(gained);
      }
    }
  }, [view, sessionId]);

  if (error) {
    return (
      <main className="grid min-h-dvh place-items-center px-4 text-center">
        <p className="text-lg font-bold text-amber">{error}</p>
      </main>
    );
  }
  if (!view) {
    return (
      <main className="grid min-h-dvh place-items-center">
        <p className="text-muted" role="status">
          Joining session…
        </p>
      </main>
    );
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <SessionHeader view={view} />
      <div className="min-h-0 flex-1">
        {view.status === "LOBBY" && <Lobby view={view} friends={friends} />}
        {view.status !== "LOBBY" && view.me.role === "interviewer" && view.interviewer && <InterviewerView view={view} />}
        {view.status !== "LOBBY" && view.me.role === "interviewee" && view.interviewee && <IntervieweeView view={view} />}
      </div>
      <CompletionDialog view={view} />
    </div>
  );
}
