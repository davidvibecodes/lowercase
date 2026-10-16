import { create } from "zustand";

/** The Received badge count (R18), seeded by the server and kept live by `social:changed`. */
export const useSocial = create<{ received: number; setReceived: (n: number) => void }>((set) => ({
  received: 0,
  setReceived: (received) => set({ received }),
}));
