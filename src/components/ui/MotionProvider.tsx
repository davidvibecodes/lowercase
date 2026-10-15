"use client";

import { LazyMotion, MotionConfig, domAnimation } from "framer-motion";

/** Loads only Framer Motion's DOM animation features (KTD8). */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
