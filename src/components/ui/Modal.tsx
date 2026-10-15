"use client";

import { AnimatePresence, m } from "framer-motion";
import { useEffect, useId, useRef } from "react";
import { cn } from "@/lib/cn";

type ModalProps = {
  open: boolean;
  onClose?: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  /** When false, Esc and backdrop clicks do nothing (forced choice). */
  dismissible?: boolean;
};

/** Centered dialog with backdrop, Esc-to-close and initial focus. */
export function Modal({ open, onClose, title, children, className, dismissible = true }: ModalProps) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => {
      const first = panel.current?.querySelector<HTMLElement>("[data-autofocus], button, [href], input, textarea, select");
      first?.focus();
    }, 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [open, dismissible, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <m.div
          className="fixed inset-0 z-50 grid place-items-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div className="absolute inset-0 bg-black/70" onClick={() => dismissible && onClose?.()} aria-hidden />
          <m.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            className={cn("relative w-full max-w-md rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-2xl", className)}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 4 }}
            transition={{ type: "spring", stiffness: 520, damping: 36 }}
          >
            {title && (
              <h2 id={titleId} className="mb-3 text-xl font-extrabold tracking-tight">
                {title}
              </h2>
            )}
            {children}
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
