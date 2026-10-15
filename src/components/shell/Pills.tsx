"use client";

import { AnimatePresence, m } from "framer-motion";
import { Flame, Zap } from "lucide-react";
import { Pill } from "@/components/ui/Pill";
import { useGamification } from "@/stores/gamification";

function AnimatedCount({ value }: { value: number }) {
  return (
    <span className="relative inline-flex overflow-hidden tabular-nums">
      <AnimatePresence mode="popLayout" initial={false}>
        <m.span
          key={value}
          initial={{ y: "-90%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "90%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 32 }}
        >
          {value}
        </m.span>
      </AnimatePresence>
    </span>
  );
}

/** Server values until the store hydrates, so the first paint never shows 0. */
function useValue(key: "xp" | "streak", initial: number) {
  return useGamification((s) => (s.hydrated ? s[key] : initial));
}

export function StreakPill({ initial }: { initial: number }) {
  const streak = useValue("streak", initial);
  return (
    <Pill aria-label={`${streak} day streak`} title="Day streak">
      <AnimatedCount value={streak} />
      <Flame size={18} className={streak > 0 ? "fill-amber text-amber" : "text-faint"} aria-hidden />
    </Pill>
  );
}

export function XpPill({ initial }: { initial: number }) {
  const xp = useValue("xp", initial);
  return (
    <Pill aria-label={`${xp} XP`} title="Total XP">
      <AnimatedCount value={xp} />
      <Zap size={18} className="fill-emerald text-emerald" aria-hidden />
    </Pill>
  );
}
