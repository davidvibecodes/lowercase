"use client";

import { cn } from "@/lib/cn";
import { usePresence } from "@/stores/presence";

const LABEL = { connecting: "Connecting", online: "Online", reconnecting: "Reconnecting", offline: "Offline" } as const;

/** The user's own realtime connection (R6). */
export function OnlineBadge() {
  const status = usePresence((s) => s.status);
  return (
    <span
      role="status"
      aria-live="polite"
      className="hidden h-10 items-center gap-2 rounded-full border border-line-strong bg-surface px-3 text-sm font-bold text-muted md:inline-flex"
    >
      <span
        className={cn(
          "size-2.5 rounded-full",
          status === "online" && "bg-emerald animate-pulse-dot",
          (status === "reconnecting" || status === "connecting") && "bg-amber",
          status === "offline" && "bg-faint",
        )}
        aria-hidden
      />
      {LABEL[status]}
    </span>
  );
}
