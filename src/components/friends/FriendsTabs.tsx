"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus, Search, Trophy, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Segmented } from "@/components/ui/Tabs";
import { toast } from "@/components/ui/Toast";
import { Avatar } from "@/components/home/Avatar";
import { addFriendAction, createGroupAction, joinGroupAction, searchAction } from "@/app/(app)/friends/actions";
import { cn } from "@/lib/cn";
import type { Standing } from "@/lib/rules/league";
import { usePresence } from "@/stores/presence";
import { useInviteFriend } from "./useInviteFriend";

type Person = { id: string; username: string; firstName: string; lastName: string };
type Group = { id: string; name: string; standings: Standing[] };
type Tab = "friends" | "groups" | "search";

export function FriendsTabs({ userId, friends, groups }: { userId: string; friends: Person[]; groups: Group[] }) {
  const [tab, setTab] = useState<Tab>("friends");
  return (
    <div className="mt-8">
      <Segmented
        label="Friends sections"
        value={tab}
        onChange={setTab}
        options={[
          { value: "friends", label: "My Friends" },
          { value: "groups", label: "Groups" },
          { value: "search", label: "Search" },
        ]}
      />
      <div className="mt-6">
        {tab === "friends" && <FriendList friends={friends} />}
        {tab === "groups" && <Groups userId={userId} groups={groups} friends={friends} />}
        {tab === "search" && <SearchPanel />}
      </div>
    </div>
  );
}

function FriendList({ friends }: { friends: Person[] }) {
  const online = usePresence((s) => s.online);
  const { pending, invite, cancel } = useInviteFriend();
  const sorted = [...friends].sort((a, b) => Number(Boolean(online[b.id])) - Number(Boolean(online[a.id])));
  if (!friends.length) return <p className="text-muted">No friends yet. Find people in Search.</p>;
  return (
    <ul className="space-y-2.5" aria-label="Friends">
      {sorted.map((f) => {
        const isOnline = Boolean(online[f.id]);
        const waiting = pending?.toUserId === f.id;
        return (
          <li key={f.id} data-testid={`friend-${f.username}`} className="flex items-center gap-4 rounded-3xl border border-line bg-surface px-4 py-3.5">
            <Avatar first={f.firstName} last={f.lastName} online={isOnline} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-extrabold">
                {f.firstName} {f.lastName}
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

function Groups({ userId, groups, friends }: { userId: string; groups: Group[]; friends: Person[] }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(groups[0]?.id ?? null);
  const group = groups.find((g) => g.id === selected) ?? groups[0];
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setSelected(g.id)}
              aria-pressed={group?.id === g.id}
              className={cn("rounded-2xl border px-4 py-2 font-bold", group?.id === g.id ? "border-royal-bright bg-royal-soft" : "border-line bg-surface hover:border-line-strong")}
            >
              {g.name}
            </button>
          ))}
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus size={18} aria-hidden /> Create Group
        </Button>
      </div>
      {group ? (
        <Card className="p-6">
          <div className="mb-4 flex items-center gap-3">
            <Trophy className="text-amber" aria-hidden />
            <h2 className="text-lg font-extrabold">{group.name} · this week</h2>
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
      ) : (
        <p className="text-muted">No groups yet.</p>
      )}
      <CreateGroupDialog open={open} onClose={() => setOpen(false)} friends={friends} />
    </div>
  );
}

function CreateGroupDialog({ open, onClose, friends }: { open: boolean; onClose: () => void; friends: Person[] }) {
  const [name, setName] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const submit = () =>
    start(async () => {
      const r = await createGroupAction(name, members);
      if (!r.ok) return setError(r.error);
      toast(`Created ${name.trim()}`, "success");
      setName("");
      setMembers([]);
      setError(null);
      onClose();
    });
  return (
    <Modal open={open} onClose={onClose} title="Create a study group">
      <label className="block text-sm font-bold text-muted" htmlFor="group-name">
        Group name
      </label>
      <input
        id="group-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="mt-1 h-11 w-full rounded-xl border border-line-strong bg-obsidian px-3 font-semibold outline-none focus:border-royal-bright"
        data-autofocus
      />
      <fieldset className="mt-4">
        <legend className="text-sm font-bold text-muted">Invite friends</legend>
        <div className="mt-2 space-y-1.5">
          {friends.map((f) => (
            <label key={f.id} className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-surface-2">
              <input
                type="checkbox"
                className="size-4 accent-[var(--color-royal-bright)]"
                checked={members.includes(f.id)}
                onChange={(e) => setMembers((m) => (e.target.checked ? [...m, f.id] : m.filter((x) => x !== f.id)))}
              />
              {f.firstName} {f.lastName}
            </label>
          ))}
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="mt-3 text-sm font-bold text-amber">
          {error}
        </p>
      )}
      <div className="mt-6 flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
        <Button className="flex-1" disabled={pending} onClick={submit}>
          Create
        </Button>
      </div>
    </Modal>
  );
}

function SearchPanel() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Awaited<ReturnType<typeof searchAction>>>({ people: [], groups: [] });
  const [, start] = useTransition();

  useEffect(() => {
    const t = window.setTimeout(() => start(async () => setResults(await searchAction(query))), 150);
    return () => window.clearTimeout(t);
  }, [query]);

  return (
    <div>
      <label className="relative block">
        <span className="sr-only">Search people and groups</span>
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-faint" aria-hidden />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people or groups"
          className="h-12 w-full rounded-2xl border border-line-strong bg-surface pl-11 pr-4 font-semibold outline-none focus:border-royal-bright"
        />
      </label>
      {query.trim().length >= 2 && (
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <section aria-label="People">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-[0.14em] text-faint">People</h2>
            {results.people.length === 0 && <p className="text-sm text-muted">No people found.</p>}
            <ul className="space-y-2">
              {results.people.map((p) => (
                <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-3 py-2.5">
                  <Avatar first={p.firstName} last={p.lastName} size="sm" />
                  <span className="flex-1 truncate font-bold">
                    {p.firstName} {p.lastName}
                  </span>
                  {p.isFriend ? (
                    <span className="text-sm font-bold text-faint">Friend</span>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={async () => {
                        const r = await addFriendAction(p.id);
                        if (r.ok) {
                          toast(`${p.firstName} added`, "success");
                          setResults((x) => ({ ...x, people: x.people.map((y) => (y.id === p.id ? { ...y, isFriend: true } : y)) }));
                        }
                      }}
                    >
                      <UserPlus size={16} aria-hidden /> Add friend
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </section>
          <section aria-label="Groups">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-[0.14em] text-faint">Groups</h2>
            {results.groups.length === 0 && <p className="text-sm text-muted">No groups found.</p>}
            <ul className="space-y-2">
              {results.groups.map((g) => (
                <li key={g.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-3 py-2.5">
                  <span className="flex-1 truncate font-bold">{g.name}</span>
                  <span className="text-sm text-faint">{g.memberCount} members</span>
                  {g.isMember ? (
                    <span className="text-sm font-bold text-faint">Joined</span>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={async () => {
                        await joinGroupAction(g.id);
                        setResults((x) => ({ ...x, groups: x.groups.map((y) => (y.id === g.id ? { ...y, isMember: true } : y)) }));
                      }}
                    >
                      Join
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
