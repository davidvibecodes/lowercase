"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { LogOut, Plus, Search, Trophy } from "lucide-react";
import { joinGroupAction, leaveGroupAction, searchGroupsAction } from "@/app/(app)/friends/actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { toast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import type { PersonRef } from "@/lib/realtime/events";
import type { Standing } from "@/lib/rules/league";
import type { GroupResult } from "@/server/services/social";
import { CreateGroupDialog } from "./CreateGroupDialog";

type MyGroup = { id: string; name: string; owned: boolean; standings: Standing[] };

/** R20: group search beside Create Group on one row; my groups with weekly leaderboards below. */
export function GroupsPanel({ userId, groups, friends }: { userId: string; groups: MyGroup[]; friends: PersonRef[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GroupResult[] | null>(null);
  const [busy, start] = useTransition();
  const seq = useRef(0);
  const term = query.trim();

  const lookup = async (q: string) => {
    const id = ++seq.current;
    const r = await searchGroupsAction(q);
    if (id === seq.current) setResults(r);
  };

  useEffect(() => {
    if (term.length < 2) {
      seq.current++;
      setResults(null);
      return;
    }
    const t = window.setTimeout(() => void lookup(term), 250);
    return () => window.clearTimeout(t);
  }, [term]);

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string, after?: () => Promise<void>) =>
    start(async () => {
      const r = await fn();
      toast(r.ok ? ok : (r.error ?? "Something went wrong"), r.ok ? "success" : "warning");
      await after?.();
    });

  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        <label className="relative block min-w-0 flex-1">
          <span className="sr-only">Search groups by name</span>
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-faint" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search groups by name..."
            className="h-12 w-full rounded-2xl border border-line-strong bg-surface pl-11 pr-4 font-semibold outline-none focus:border-royal-bright"
          />
        </label>
        <Button size="lg" className="shrink-0" onClick={() => setOpen(true)}>
          <Plus size={18} aria-hidden /> <span className="hidden sm:inline">Create Group</span>
          <span className="sr-only sm:hidden">Create Group</span>
        </Button>
      </div>

      {results !== null ? (
        <section aria-label="Group search results">
          {results.length === 0 && <p className="text-muted">No groups match “{term}”.</p>}
          <ul className="space-y-2.5">
            {results.map((g) => (
              <li key={g.id} className="flex items-center gap-3 rounded-3xl border border-line bg-surface px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{g.name}</p>
                  <p className="truncate text-sm text-faint">
                    By {g.ownerName} · {g.memberCount} {g.memberCount === 1 ? "member" : "members"}
                  </p>
                </div>
                {g.isMember ? (
                  <span className="text-sm font-bold text-emerald">Joined</span>
                ) : (
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => act(() => joinGroupAction(g.id), `You joined ${g.name}`, () => lookup(term))}>
                    Join
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : groups.length ? (
        <div className="space-y-5">
          {groups.map((group) => (
            <Card key={group.id} className="p-6" data-testid={`group-${group.name}`}>
              <div className="mb-4 flex items-center gap-3">
                <Trophy className="text-amber" aria-hidden />
                <h2 className="flex-1 truncate text-lg font-extrabold">{group.name} · this week</h2>
                {!group.owned && (
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(() => leaveGroupAction(group.id), `You left ${group.name}`)}>
                    <LogOut size={16} aria-hidden /> Leave
                  </Button>
                )}
              </div>
              <ol className="space-y-1.5">
                {group.standings.map((s) => (
                  <li key={s.id} className={cn("flex items-center rounded-2xl px-4 py-3", s.id === userId ? "bg-royal font-extrabold text-white" : "text-muted")}>
                    <span className="w-10 tabular-nums">{s.rank}</span>
                    <span className="flex-1 font-bold">{s.name}</span>
                    <span className="tabular-nums">{s.weeklyXp} XP</span>
                  </li>
                ))}
              </ol>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-muted">You&apos;re not in any groups yet. Search for one by name, or create your own.</p>
      )}
      <CreateGroupDialog open={open} onClose={() => setOpen(false)} friends={friends} />
    </div>
  );
}
