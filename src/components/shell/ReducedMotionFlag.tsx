"use client";

import { MotionConfig } from "framer-motion";
import { useEffect } from "react";

/** Applies the user's Reduce motion preference to CSS and Framer Motion. */
export function ReducedMotionFlag({ on, children }: { on: boolean; children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.dataset.reducedMotion = on ? "true" : "false";
  }, [on]);
  return <MotionConfig reducedMotion={on ? "always" : "user"}>{children}</MotionConfig>;
}
