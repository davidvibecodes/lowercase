"use client";

import { useActionState } from "react";
import { ArrowRight, Users } from "lucide-react";
import { signInAction, type LoginState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/Button";
import { PeerTesterMenu } from "./PeerTesterMenu";

const OWNER = "davidsathyandevice";

export function LoginForm({ initialError, peers }: { initialError?: string; peers: Array<{ username: string; firstName: string; lastName: string }> }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(signInAction, { error: initialError });

  return (
    <div className="mt-7 space-y-6">
      <form action={action} className="space-y-3">
        <label htmlFor="username" className="block text-sm font-bold text-muted">
          Username
        </label>
        <input
          id="username"
          name="username"
          defaultValue={OWNER}
          autoComplete="username"
          spellCheck={false}
          className="h-12 w-full rounded-2xl border border-line-strong bg-obsidian px-4 text-[15px] font-semibold text-ink outline-none transition-colors placeholder:text-faint focus:border-royal-bright"
        />
        {state.error && (
          <p role="alert" className="text-sm font-bold text-amber">
            {state.error}
          </p>
        )}
        <Button type="submit" size="lg" block disabled={pending}>
          Continue as {OWNER} (test login, no admin)
          <ArrowRight size={18} aria-hidden />
        </Button>
      </form>

      <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.14em] text-faint">
        <span className="h-px flex-1 bg-line" /> Testing <span className="h-px flex-1 bg-line" />
      </div>

      <PeerTesterMenu peers={peers}>
        <Users size={18} aria-hidden /> Open as Online Friend / Peer Tester
      </PeerTesterMenu>
    </div>
  );
}
