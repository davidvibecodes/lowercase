"use client";

import { AnimatePresence, m } from "framer-motion";
import { create } from "zustand";
import { cn } from "@/lib/cn";

type Tone = "info" | "success" | "warning";
type ToastItem = { id: number; message: string; tone: Tone };

type ToastState = {
  items: ToastItem[];
  push: (message: string, tone?: Tone) => void;
  dismiss: (id: number) => void;
};

let seq = 0;

export const useToasts = create<ToastState>((set, get) => ({
  items: [],
  push: (message, tone = "info") => {
    const id = ++seq;
    set({ items: [...get().items, { id, message, tone }] });
    window.setTimeout(() => get().dismiss(id), 4000);
  },
  dismiss: (id) => set({ items: get().items.filter((t) => t.id !== id) }),
}));

export function toast(message: string, tone?: Tone) {
  useToasts.getState().push(message, tone);
}

export function Toaster() {
  const items = useToasts((s) => s.items);
  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2" aria-live="polite">
      <AnimatePresence>
        {items.map((t) => (
          <m.div
            key={t.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className={cn(
              "pointer-events-auto rounded-2xl border px-4 py-2.5 text-sm font-bold shadow-xl",
              t.tone === "success" && "border-emerald/50 bg-surface text-emerald",
              t.tone === "warning" && "border-amber/50 bg-surface text-amber",
              t.tone === "info" && "border-line bg-surface text-ink",
            )}
          >
            {t.message}
          </m.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
