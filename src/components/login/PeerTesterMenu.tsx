"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { peerTesterUrl } from "@/lib/peer-url";

export function PeerTesterMenu({ peers, children }: { peers: Array<{ username: string; firstName: string; lastName: string }>; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <Button variant="secondary" size="lg" block aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {children}
      </Button>
      {open && (
        <ul className="mt-3 space-y-2" aria-label="Peer testers">
          {peers.map((p) => (
            <li key={p.username}>
              <button
                type="button"
                onClick={() => window.open(peerTesterUrl(p.username, window.location), "_blank", "noopener")}
                className="flex w-full items-center justify-between rounded-2xl border border-line bg-obsidian px-4 py-3 text-left transition-colors hover:border-line-strong hover:bg-surface-2"
              >
                <span className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-full bg-royal-soft text-sm font-extrabold text-royal-bright">
                    {p.firstName[0]}
                    {p.lastName[0]}
                  </span>
                  <span>
                    <span className="block font-bold">
                      {p.firstName} {p.lastName}
                    </span>
                    <span className="block text-xs text-faint">Opens a new tab on the other hostname</span>
                  </span>
                </span>
                <ExternalLink size={16} className="text-faint" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
