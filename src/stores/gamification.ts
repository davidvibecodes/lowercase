import { create } from "zustand";

type GamificationState = {
  hydrated: boolean;
  xp: number;
  streak: number;
  hydrate: (p: { xp: number; streak: number }) => void;
  addXp: (amount: number) => void;
  setStreak: (n: number) => void;
};

export const useGamification = create<GamificationState>((set) => ({
  hydrated: false,
  xp: 0,
  streak: 0,
  hydrate: ({ xp, streak }) => set({ xp, streak, hydrated: true }),
  addXp: (amount) => set((s) => ({ xp: s.xp + amount })),
  setStreak: (streak) => set({ streak }),
}));
