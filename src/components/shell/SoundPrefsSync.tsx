"use client";

import { useEffect } from "react";
import { applyStorageEvent, hydrateSound } from "@/stores/sound";

/** Seeds the sound preference from the account and follows changes made in the user's other tabs (R15). */
export function SoundPrefsSync({ userId, soundOn }: { userId: string; soundOn: boolean }) {
  useEffect(() => {
    hydrateSound(userId, soundOn);
  }, [userId, soundOn]);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => applyStorageEvent(e.key, e.newValue);
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return null;
}
