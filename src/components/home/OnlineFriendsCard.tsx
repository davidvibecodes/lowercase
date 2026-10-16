"use client";

import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useInviteFriend } from "@/components/friends/useInviteFriend";
import { usePresence } from "@/stores/presence";
import { Avatar } from "./Avatar";

type Friend = { id: string; username: string; firstName: string; lastName: string; avatarUrl?: string | null };

export function OnlineFriendsCard({ friends }: { friends: Friend[] }) {
  const online = usePresence((s) => s.online);
  const { pending, invite, cancel } = useInviteFriend();
  const list = friends.filter((f) => online[f.id]);

  return (
    <Card className="p-6">
      <CardHeader title="Online friends" eyebrow="Quick start" />
      {list.length === 0 ? (
        <p className="text-sm text-muted">No friends online. Open a peer tester tab from the login page.</p>
      ) : (
        <ul className="space-y-2">
          {list.map((f) => {
            const waiting = pending?.toUserId === f.id;
            return (
              <li key={f.id} className="flex items-center gap-3 rounded-2xl border border-line bg-obsidian px-3 py-2.5">
                <Avatar first={f.firstName} last={f.lastName} src={f.avatarUrl} online />
                <span className="flex-1 truncate font-bold">
                  {f.firstName} {f.lastName}
                </span>
                {waiting ? (
                  <Button size="sm" variant="secondary" onClick={cancel}>
                    Waiting… Cancel
                  </Button>
                ) : (
                  <Button size="sm" variant="success" disabled={Boolean(pending)} onClick={() => invite(f.id, f.firstName)}>
                    Start Session
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
