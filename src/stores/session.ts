import { create } from "zustand";
import type { SessionView } from "@/lib/realtime/events";

/** Client mirror of the server's session projection; only snapshots write it (KTD2). */
type SessionState = { view: SessionView | null; error: string | null; setView: (v: SessionView | null) => void; setError: (e: string | null) => void };

export const useSessionStore = create<SessionState>((set) => ({
  view: null,
  error: null,
  setView: (view) => set({ view, error: null }),
  setError: (error) => set({ error }),
}));
