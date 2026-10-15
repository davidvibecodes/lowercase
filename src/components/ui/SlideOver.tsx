"use client";

import { AnimatePresence, m } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useId } from "react";

/** Right-hand panel that scrolls independently and closes on Esc. */
export function SlideOver({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <m.div className="fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />
          <m.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col border-l border-line bg-surface shadow-2xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 420, damping: 40 }}
          >
            <header className="flex items-center justify-between border-b border-line px-6 py-4">
              <h2 id={titleId} className="text-lg font-extrabold">
                {title}
              </h2>
              <button type="button" onClick={onClose} className="rounded-xl p-2 text-muted hover:bg-surface-2 hover:text-ink" aria-label="Close">
                <X size={20} />
              </button>
            </header>
            <div className="scrollbar-thin flex-1 overflow-y-auto px-6 py-5">{children}</div>
          </m.aside>
        </m.div>
      )}
    </AnimatePresence>
  );
}
