"use client";

import { Avatar } from "@/components/home/Avatar";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { PersonRef } from "@/lib/realtime/events";
import { usePresence } from "@/stores/presence";
import { useInviteFriend } from "./useInviteFriend";

/** Accepted friends with live presence; Start Session needs them online (R22). */
export function FriendList({ friends, onFind }: { friends: PersonRef[]; onFind: () => void }) {
  const online = usePresence((s) => s.online);
  const { pending, invite, cancel } = useInviteFriend();
  const sorted = [...friends].sort((a, b) => Number(Boolean(online[b.id])) - Number(Boolean(online[a.id])));
  if (!friends.length) {
    return (
      <div className="rounded-3xl border border-dashed border-line px-6 py-10 text-center">
        <p className="font-bold">No friends yet</p>
        <p className="mt-1 text-sm text-muted">Ask a friend for their username, then send them a request.</p>
        <Button variant="secondary" className="mt-4" onClick={onFind}>
          Find by username
        </Button>
      </div>
    );
  }
  return (
    <ul className="space-y-2.5" aria-label="Friends">
      {sorted.map((f) => {
        const isOnline = Boolean(online[f.id]);
        const waiting = pending?.toUserId === f.id;
        return (
          <li key={f.id} data-testid={`friend-${f.username}`} className="flex items-center gap-4 rounded-3xl border border-line bg-surface px-4 py-3.5">
            <Avatar first={f.firstName} last={f.lastName} src={f.avatarUrl} online={isOnline} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-extrabold">
                {f.firstName} {f.lastName} <span className="font-semibold text-faint">@{f.username}</span>
              </p>
              <p className={cn("text-sm font-bold", isOnline ? "text-emerald" : "text-faint")}>{isOnline ? "Online" : "Offline"}</p>
            </div>
            {waiting ? (
              <Button size="sm" variant="secondary" onClick={cancel}>
                Waiting for {f.firstName}… Cancel
              </Button>
            ) : (
              <Button
                size="sm"
                variant="success"
                disabled={!isOnline || Boolean(pending)}
                title={isOnline ? undefined : "Friend must be online"}
                onClick={() => invite(f.id, f.firstName)}
              >
                Start Session
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
