"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { usePresence } from "@/stores/presence";
import { useSocial } from "@/stores/social";
import { getSocket } from "./socket";

/** Connects the tab's socket and feeds the presence store (U4). */
export function RealtimeBridge({ initialOnline, initialReceived }: { initialOnline: string[]; initialReceived: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);
  useEffect(() => {
    useSocial.getState().setReceived(initialReceived);
  }, [initialReceived]);
  useEffect(() => {
    const store = usePresence.getState();
    store.setSnapshot(initialOnline);
    const s = getSocket();
    const onConnect = () => usePresence.getState().setStatus("online");
    const onDisconnect = () => usePresence.getState().setStatus("reconnecting");
    const onError = () => usePresence.getState().setStatus(s.active ? "reconnecting" : "offline");
    const onSnapshot = (ids: string[]) => usePresence.getState().setSnapshot(ids);
    const onUpdate = (p: { userId: string; online: boolean }) => usePresence.getState().setOnline(p.userId, p.online);
    // A request or invite changed for me: update the badge everywhere, refresh only pages that list friends (R18, KTD9).
    // On (re)connect the server resends the count, since changes made while the socket was down were missed;
    // that resync refreshes only when the count moved, so an ordinary page load doesn't refresh twice.
    const onSocial = (p: { received: number; resync?: boolean }) => {
      const moved = p.received !== useSocial.getState().received;
      useSocial.getState().setReceived(p.received);
      if ((moved || !p.resync) && (pathRef.current === "/" || pathRef.current === "/friends")) router.refresh();
    };
    if (s.connected) onConnect();
    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    s.on("connect_error", onError);
    s.on("presence:snapshot", onSnapshot);
    s.on("presence:update", onUpdate);
    s.on("social:changed", onSocial);
    return () => {
      s.off("social:changed", onSocial);
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
