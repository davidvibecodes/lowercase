import { create } from "zustand";

export type ConnectionStatus = "connecting" | "online" | "reconnecting" | "offline";

type PresenceState = {
  status: ConnectionStatus;
  online: Record<string, true>;
  setStatus: (s: ConnectionStatus) => void;
  setSnapshot: (ids: string[]) => void;
  setOnline: (userId: string, online: boolean) => void;
};

export const usePresence = create<PresenceState>((set) => ({
  status: "connecting",
  online: {},
  setStatus: (status) => set({ status }),
  setSnapshot: (ids) => set({ online: Object.fromEntries(ids.map((id) => [id, true as const])) }),
  setOnline: (userId, online) =>
    set((s) => {
      const next = { ...s.online };
      if (online) next[userId] = true;
      else delete next[userId];
      return { online: next };
    }),
}));

export const useIsOnline = (userId: string) => usePresence((s) => Boolean(s.online[userId]));
