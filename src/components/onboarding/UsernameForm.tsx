"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { claimUsernameAction, type ClaimState } from "@/app/onboarding/username/actions";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { normalizeUsername } from "@/lib/username";

type Status =
  | { kind: "idle" }
  | { kind: "invalid"; reason: string }
  | { kind: "checking" }
  | { kind: "available" }
  | { kind: "taken" }
  | { kind: "error" };

const DEBOUNCE_MS = 300;

/** R9: live availability, 300 ms after typing stops; Save only when the current input is confirmed free. */
export function UsernameForm() {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [retry, setRetry] = useState(0);
  const seq = useRef(0);
  const submitted = useRef("");
  const [state, action, pending] = useActionState<ClaimState, FormData>(claimUsernameAction, {});

  useEffect(() => {
    const id = ++seq.current;
    if (!value.trim()) {
      setStatus({ kind: "idle" });
      return;
    }
    const local = normalizeUsername(value);
    if (!local.ok) {
      setStatus({ kind: "invalid", reason: local.reason });
      return;
    }
    setStatus({ kind: "checking" });
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/check-username?username=${encodeURIComponent(local.username)}`, { cache: "no-store" });
        if (id !== seq.current) return; // a newer keystroke owns the status
        if (res.status === 401) {
          window.location.assign("/login");
          return;
        }
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { available: boolean; reason?: string };
        if (id !== seq.current) return;
        if (body.available) setStatus({ kind: "available" });
        else if (body.reason === "taken") setStatus({ kind: "taken" });
        else setStatus({ kind: "invalid", reason: body.reason ?? "Not allowed" });
      } catch {
        if (id === seq.current) setStatus({ kind: "error" });
      }
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [value, retry]);

  // A save that lost the race comes back as "taken" and keeps the input (R10).
  const serverTaken = state.error === "Username is already taken" && value === submitted.current;
  const shown: Status = serverTaken && status.kind === "available" ? { kind: "taken" } : status;

  return (
    <form action={action} onSubmit={() => (submitted.current = value)} className="mt-6 space-y-3">
      <label htmlFor="username" className="block text-sm font-bold text-muted">
        Username
      </label>
      <div className="flex h-12 items-center rounded-2xl border border-line-strong bg-obsidian px-4 focus-within:border-royal-bright">
        <span className="font-bold text-faint" aria-hidden>
          @
        </span>
        <input
          id="username"
          name="username"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={21}
          aria-describedby="username-status"
          className="h-full flex-1 bg-transparent pl-1 text-[15px] font-semibold text-ink outline-none"
          data-autofocus
        />
      </div>
      <p id="username-status" role="status" aria-live="polite" className={cn("min-h-5 text-sm font-bold", statusTone(shown))}>
        {statusText(shown)}
        {shown.kind === "error" && (
          <button type="button" onClick={() => setRetry((n) => n + 1)} className="ml-2 underline underline-offset-4">
            Retry
          </button>
        )}
      </p>
      <p className="text-xs text-faint">3–20 characters: a letter first, then letters a–z, digits, dots or underscores.</p>
      {state.error && state.error !== "Username is already taken" && value === submitted.current && (
        <p role="alert" className="text-sm font-bold text-amber">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" block disabled={shown.kind !== "available" || pending}>
        Save and continue
      </Button>
    </form>
  );
}

function statusText(s: Status): string {
  switch (s.kind) {
    case "checking":
      return "Checking...";
    case "available":
      return "✓ Username is available";
    case "taken":
      return "✗ Username is already taken";
    case "invalid":
      return s.reason;
    case "error":
      return "Couldn't check right now.";
    default:
      return "";
  }
}

function statusTone(s: Status): string {
  if (s.kind === "available") return "text-emerald";
  if (s.kind === "taken" || s.kind === "invalid" || s.kind === "error") return "text-amber";
  return "text-faint";
}
