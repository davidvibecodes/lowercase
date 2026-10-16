"use client";

import { create } from "zustand";

/**
 * The Sound effects preference (R14, R15, KTD14). The account value is
 * authoritative on load; a per-user localStorage copy carries changes to the
 * user's other open tabs through the `storage` event.
 */
type SoundState = { enabled: boolean; userId: string | null; setEnabled: (on: boolean) => void };

export const useSound = create<SoundState>((set) => ({
  enabled: true,
  userId: null,
  setEnabled: (enabled) => set({ enabled }),
}));

export const soundStorageKey = (userId: string) => `lc:sound:${userId}`;

function mirror(userId: string | null, on: boolean) {
  if (!userId) return;
  try {
    localStorage.setItem(soundStorageKey(userId), on ? "true" : "false");
  } catch {
    // Storage can be unavailable (private mode, quota); the account value still applies.
  }
}

/** Seeds the store from the account on every app load (AppShell). */
export function hydrateSound(userId: string, enabled: boolean) {
  useSound.setState({ userId, enabled });
  mirror(userId, enabled);
}

/** Handles a `storage` event from another tab; ignores other users' keys. */
export function applyStorageEvent(key: string | null, value: string | null) {
  const { userId } = useSound.getState();
  if (!userId || key !== soundStorageKey(userId) || (value !== "true" && value !== "false")) return;
  useSound.getState().setEnabled(value === "true");
}

/** Flips immediately, then saves; reverts and returns false when the save fails (R14). */
export async function setSoundPreference(on: boolean, save: () => Promise<{ ok: boolean }>): Promise<boolean> {
  const { userId, enabled: previous } = useSound.getState();
  useSound.getState().setEnabled(on);
  mirror(userId, on);
  let ok = false;
  try {
    ok = (await save()).ok;
  } catch {
    ok = false;
  }
  if (!ok) {
    useSound.getState().setEnabled(previous);
    mirror(userId, previous);
  }
  return ok;
}
