"use client";

import { useRouter } from "next/navigation";
import { Repeat, ListRestart, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/components/ui/Toast";
import type { SessionView } from "@/lib/realtime/events";
import { emitAck } from "@/lib/realtime/socket";

/** Post-case choices for both players; the first action the server receives wins (R24). */
export function CompletionDialog({ view }: { view: SessionView }) {
  const router = useRouter();
  const open = view.status === "SOLVED";
  const r = view.result;
  const act = async (event: "session:switchRoles" | "session:newCase" | "session:close") => {
    const res = await emitAck(event, { sessionId: view.id });
    if (!res.ok) toast(res.error);
    if (event === "session:close" && res.ok) router.push("/");
  };
  const intervieweeName = view.me.role === "interviewee" ? "You" : view.partner?.firstName;

  return (
    <Modal open={open} dismissible={false} title="Case solved!" className="max-w-lg">
      {r && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-line bg-obsidian p-4">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-faint">{intervieweeName} scored</p>
            <p className="mt-1 text-3xl font-extrabold tabular-nums">
              {r.avgScore.toFixed(1)}
              <span className="text-base text-faint"> / 5</span>
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-obsidian p-4">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-faint">You earned</p>
            <p className="mt-1 flex items-center gap-1 text-3xl font-extrabold tabular-nums">
              +{r.xp[view.me.id] ?? 0} <Zap size={22} className="fill-emerald text-emerald" aria-hidden />
            </p>
          </div>
        </div>
      )}
      <div className="mt-6 grid gap-2.5">
        <Button size="lg" onClick={() => act("session:switchRoles")} data-autofocus>
          <Repeat size={18} aria-hidden /> Switch Roles
        </Button>
        <Button size="lg" variant="secondary" onClick={() => act("session:newCase")}>
          <ListRestart size={18} aria-hidden /> Select New Case
        </Button>
        <Button size="lg" variant="ghost" onClick={() => act("session:close")}>
          <X size={18} aria-hidden /> Close
        </Button>
      </div>
    </Modal>
  );
}
