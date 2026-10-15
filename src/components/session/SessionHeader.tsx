"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Wordmark } from "@/components/shell/Wordmark";
import { toast } from "@/components/ui/Toast";
import type { SessionView } from "@/lib/realtime/events";
import { emitAck } from "@/lib/realtime/socket";
import { DIFFICULTY_LABEL } from "@/lib/types";
import { PartnerStatus } from "./PartnerStatus";
import { TranscriptButton } from "./interviewer/TranscriptSlideOver";

export function SessionHeader({ view }: { view: SessionView }) {
  const [confirm, setConfirm] = useState(false);
  const end = async () => {
    setConfirm(false);
    const r = await emitAck("session:close", { sessionId: view.id });
    if (!r.ok) toast(r.error, "warning");
  };
  const title = view.selectedCase && view.status !== "LOBBY" ? view.selectedCase.title : "Session lobby";
  const sub =
    view.selectedCase && view.status !== "LOBBY"
      ? `${view.selectedCase.caseType} · ${DIFFICULTY_LABEL[view.selectedCase.difficulty as 1 | 2 | 3]} · Round ${view.round}`
      : `Round ${view.round}`;

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-line bg-obsidian px-4 sm:px-6">
      <Wordmark className="hidden !text-[22px] sm:inline" />
      <div className="min-w-0 flex-1 sm:border-l sm:border-line sm:pl-4">
        <p className="truncate font-extrabold leading-tight">{title}</p>
        <p className="truncate text-xs font-bold text-faint">{sub}</p>
      </div>
      <PartnerStatus view={view} />
      {view.me.role === "interviewer" && view.interviewer && <TranscriptButton transcript={view.interviewer.transcript} />}
      <Button size="sm" variant="secondary" onClick={() => setConfirm(true)}>
        <LogOut size={16} aria-hidden /> End session
      </Button>
      <Modal open={confirm} onClose={() => setConfirm(false)} title="End this session?">
        <p className="text-muted">
          {view.status === "ACTIVE" ? "The current round will be discarded and no XP is awarded. " : ""}
          This ends the session for both of you.
        </p>
        <div className="mt-6 flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => setConfirm(false)} data-autofocus>
            Stay
          </Button>
          <Button variant="warning" className="flex-1" onClick={end}>
            End session
          </Button>
        </div>
      </Modal>
    </header>
  );
}
