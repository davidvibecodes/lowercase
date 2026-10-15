"use client";

import { useEffect } from "react";
import { usePresence } from "@/stores/presence";
import { getSocket } from "./socket";

/** Connects the tab's socket and feeds the presence store (U4). */
export function RealtimeBridge({ initialOnline }: { initialOnline: string[] }) {
  useEffect(() => {
    const store = usePresence.getState();
    store.setSnapshot(initialOnline);
    const s = getSocket();
    const onConnect = () => usePresence.getState().setStatus("online");
    const onDisconnect = () => usePresence.getState().setStatus("reconnecting");
    const onError = () => usePresence.getState().setStatus(s.active ? "reconnecting" : "offline");
    const onSnapshot = (ids: string[]) => usePresence.getState().setSnapshot(ids);
    const onUpdate = (p: { userId: string; online: boolean }) => usePresence.getState().setOnline(p.userId, p.online);
    if (s.connected) onConnect();
    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    s.on("connect_error", onError);
    s.on("presence:snapshot", onSnapshot);
    s.on("presence:update", onUpdate);
    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
      s.off("connect_error", onError);
      s.off("presence:snapshot", onSnapshot);
      s.off("presence:update", onUpdate);
    };
    // initialOnline is first-paint data only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
