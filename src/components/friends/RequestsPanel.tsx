"use client";

import { useTransition } from "react";
import { Users } from "lucide-react";
import {
  cancelFriendRequestAction,
  cancelGroupInviteAction,
  respondFriendRequestAction,
  respondGroupInviteAction,
} from "@/app/(app)/friends/actions";
import { Avatar } from "@/components/home/Avatar";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import type { PersonRef } from "@/lib/realtime/events";

type FriendRequestRow = { id: string; person: PersonRef };
type GroupInviteRow = { id: string; group: { id: string; name: string }; person: PersonRef };

/** Sent and Received friend requests and group invites (R19, R21). */
export function RequestsPanel({ mode, friendRequests, groupInvites }: { mode: "sent" | "received"; friendRequests: FriendRequestRow[]; groupInvites: GroupInviteRow[] }) {
  const [busy, start] = useTransition();
  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) =>
    start(async () => {
      const r = await fn();
      toast(r.ok ? ok : (r.error ?? "Something went wrong"), r.ok ? "success" : "warning");
    });

  const empty = mode === "sent" ? "Nothing waiting on anyone else." : "No requests or invites right now.";

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <section aria-label={mode === "sent" ? "Friend requests you sent" : "Friend requests for you"}>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-faint">Friend requests</h2>
        {friendRequests.length === 0 && <p className="text-sm text-muted">{empty}</p>}
        <ul className="space-y-2.5">
          {friendRequests.map((r) => (
            <li key={r.id} className="flex items-center gap-3 rounded-3xl border border-line bg-surface px-4 py-3">
              <Avatar first={r.person.firstName} last={r.person.lastName} src={r.person.avatarUrl} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">
                  {r.person.firstName} {r.person.lastName}
                </p>
                <p className="truncate text-sm text-faint">@{r.person.username}</p>
              </div>
              {mode === "received" ? (
                <div className="flex gap-2">
                  <Button size="sm" variant="success" disabled={busy} onClick={() => act(() => respondFriendRequestAction(r.id, true), `You and ${r.person.firstName} are friends`)}>
                    Accept
                  </Button>
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => act(() => respondFriendRequestAction(r.id, false), "Request declined")}>
                    Decline
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => act(() => cancelFriendRequestAction(r.id), "Request cancelled")}>
                  Cancel
                </Button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section aria-label={mode === "sent" ? "Group invites you sent" : "Group invites for you"}>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-faint">Group invites</h2>
        {groupInvites.length === 0 && <p className="text-sm text-muted">{empty}</p>}
        <ul className="space-y-2.5">
          {groupInvites.map((i) => (
            <li key={i.id} className="flex items-center gap-3 rounded-3xl border border-line bg-surface px-4 py-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-royal-soft text-royal-bright" aria-hidden>
                <Users size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{i.group.name}</p>
                <p className="truncate text-sm text-faint">
                  {mode === "received" ? `From ${i.person.firstName} ${i.person.lastName}` : `To ${i.person.firstName} ${i.person.lastName}`}
                </p>
              </div>
              {mode === "received" ? (
                <div className="flex gap-2">
                  <Button size="sm" variant="success" disabled={busy} onClick={() => act(() => respondGroupInviteAction(i.id, true), `You joined ${i.group.name}`)}>
                    Join
                  </Button>
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => act(() => respondGroupInviteAction(i.id, false), "Invite declined")}>
                    Decline
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => act(() => cancelGroupInviteAction(i.id), "Invite cancelled")}>
                  Cancel
                </Button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
