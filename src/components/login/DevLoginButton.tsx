"use client";

import { useActionState } from "react";
import { ArrowRight } from "lucide-react";
import { signInAction, type LoginState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/Button";

/** One-click test login for a seeded account (POST through a server action, KTD16). */
export function DevLoginButton({ username, label, variant = "primary" }: { username: string; label: string; variant?: "primary" | "secondary" }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(signInAction, {});
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="username" value={username} />
      <Button type="submit" size="lg" block variant={variant} disabled={pending}>
        {label}
        <ArrowRight size={18} aria-hidden />
      </Button>
      {state.error && (
        <p role="alert" className="text-sm font-bold text-amber">
          {state.error}
        </p>
      )}
    </form>
  );
}
