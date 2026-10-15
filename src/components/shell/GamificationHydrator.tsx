"use client";

import { useEffect } from "react";
import { useGamification } from "@/stores/gamification";

/** Syncs server-rendered XP and streak into the store on every navigation. */
export function GamificationHydrator({ xp, streak }: { xp: number; streak: number }) {
  useEffect(() => {
    useGamification.getState().hydrate({ xp, streak });
  }, [xp, streak]);
  return null;
}
