"use client";

import { useTransition } from "react";
import { toast } from "@/components/ui/Toast";

/**
 * Runs a server action inside a transition and toasts its outcome. `busy` is
 * true while it runs; `after` (e.g. re-running a search) runs once the toast is up.
 */
export function useToastAction() {
  const [busy, start] = useTransition();
  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string, after?: () => Promise<void>) =>
    start(async () => {
      const r = await fn();
      toast(r.ok ? ok : (r.error ?? "Something went wrong"), r.ok ? "success" : "warning");
      await after?.();
    });
  return { busy, act };
}
