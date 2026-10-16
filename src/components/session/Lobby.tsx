"use client";

import { Check, Lock, Mic, Shuffle, UserRound } from "lucide-react";
import { Avatar } from "@/components/home/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Tabs";
import { toast } from "@/components/ui/Toast";
import { useInviteFriend } from "@/components/friends/useInviteFriend";
import { cn } from "@/lib/cn";
import type { SessionView } from "@/lib/realtime/events";
import { emitAck } from "@/lib/realtime/socket";
import { unlockHint } from "@/lib/rules/gates";
import { CASE_TYPES, DIFFICULTIES, DIFFICULTY_LABEL, type Role } from "@/lib/types";
import { usePresence } from "@/stores/presence";

export type FriendRef = { id: string; username: string; firstName: string; lastName: string };

async function send<E extends Parameters<typeof emitAck>[0]>(event: E, payload: Parameters<typeof emitAck<E>>[1]) {
  const r = await emitAck(event, payload);
  if (!r.ok) toast(r.error, "warning");
}

export function Lobby({ view, friends }: { view: SessionView; friends: FriendRef[] }) {
  const hasPartner = Boolean(view.partner);
  const rolesSet = Boolean(view.me.role && view.partner?.role);
  return (
    <div className="scrollbar-thin h-full overflow-y-auto">
      <div className="mx-auto grid max-w-[1100px] gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[360px_1fr]">
        <div className="space-y-6">
          <Players view={view} />
          {!hasPartner && <InviteFriendPanel sessionId={view.id} friends={friends} view={view} />}
          {hasPartner && <RolePicker view={view} />}
        </div>
        <div className="space-y-6">
          <CaseSetup view={view} disabled={!hasPartner} />
          <ReadyBar view={view} enabled={hasPartner && rolesSet && Boolean(view.selectedCase)} />
        </div>
      </div>
    </div>
  );
}

function Players({ view }: { view: SessionView }) {
  const rows = [
    { ...view.me, you: true, connected: true },
    ...(view.partner ? [{ ...view.partner, you: false }] : []),
  ];
  return (
    <Card className="p-6">
      <h2 className="mb-4 text-lg font-extrabold">Players</h2>
      <ul className="space-y-2.5">
        {rows.map((p) => (
          <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-line bg-obsidian px-3 py-2.5">
            <Avatar first={p.firstName} last={p.lastName} src={p.avatarUrl} online={p.connected} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">
                {p.firstName} {p.lastName} {p.you && <span className="text-faint">(you)</span>}
              </p>
              <p className="text-xs font-bold capitalize text-faint">{p.role ?? "No role yet"}</p>
            </div>
            {p.ready && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-soft px-2 py-1 text-xs font-extrabold text-emerald">
                <Check size={12} aria-hidden /> Ready
              </span>
            )}
          </li>
        ))}
        {!view.partner && <li className="rounded-2xl border border-dashed border-line-strong px-3 py-3 text-sm text-faint">Waiting for a partner…</li>}
      </ul>
    </Card>
  );
}

function InviteFriendPanel({ sessionId, friends, view }: { sessionId: string; friends: FriendRef[]; view: SessionView }) {
  const online = usePresence((s) => s.online);
  const { pending, invite, cancel } = useInviteFriend();
  const list = friends.filter((f) => online[f.id]);
  const waitingFor = pending ?? (view.pendingInvite ? { inviteId: view.pendingInvite.inviteId, toUserId: view.pendingInvite.to.id } : null);
  const waitingName = friends.find((f) => f.id === waitingFor?.toUserId)?.firstName;

  return (
    <Card className="p-6">
      <h2 className="text-lg font-extrabold">Invite a friend</h2>
      <p className="mb-4 text-sm text-muted">Only online friends can join.</p>
      {waitingFor ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-royal-bright/50 bg-royal-soft px-4 py-3">
          <span className="font-bold">Waiting for {waitingName ?? "your friend"}…</span>
          <Button size="sm" variant="secondary" onClick={pending ? cancel : () => send("invite:cancel", { inviteId: waitingFor.inviteId })}>
            Cancel
          </Button>
        </div>
      ) : list.length === 0 ? (
        <p className="text-sm text-faint">No friends online right now. Open a peer tester from the login page.</p>
      ) : (
        <ul className="space-y-2">
          {list.map((f) => (
            <li key={f.id} className="flex items-center gap-3">
              <Avatar first={f.firstName} last={f.lastName} online size="sm" />
              <span className="flex-1 truncate font-bold">
                {f.firstName} {f.lastName}
              </span>
              <Button size="sm" variant="success" onClick={() => invite(f.id, f.firstName, { sessionId })}>
                Invite
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function RolePicker({ view }: { view: SessionView }) {
  const pick = (role: Role) => send("session:pickRole", { sessionId: view.id, role });
  const opts: Array<{ role: Role; title: string; body: string; icon: typeof Mic }> = [
    { role: "interviewer", title: "I'll interview", body: "See the full case, reveal facts and score the rubric.", icon: Mic },
    { role: "interviewee", title: "I'll be interviewed", body: "Solve the case from the problem statement and revealed facts.", icon: UserRound },
  ];
  return (
    <Card className="p-6">
      <h2 className="mb-4 text-lg font-extrabold">Choose roles</h2>
      <div role="radiogroup" aria-label="Your role" className="space-y-2.5">
        {opts.map(({ role, title, body, icon: Icon }) => {
          const active = view.me.role === role;
          return (
            <button
              key={role}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => pick(role)}
              className={cn("flex w-full items-start gap-3 rounded-2xl border-2 p-4 text-left transition-colors", active ? "border-royal-bright bg-royal-soft" : "border-line bg-obsidian hover:border-line-strong")}
            >
              <Icon size={20} className={active ? "text-royal-bright" : "text-muted"} aria-hidden />
              <span>
                <span className="block font-extrabold">{title}</span>
                <span className="block text-sm text-muted">{body}</span>
              </span>
            </button>
          );
        })}
      </div>
      {view.partner?.role && (
        <p className="mt-3 text-sm text-muted">
          {view.partner.firstName} is the <strong className="text-ink">{view.partner.role}</strong>.
        </p>
      )}
    </Card>
  );
}

function CaseSetup({ view, disabled }: { view: SessionView; disabled: boolean }) {
  const caseType = view.caseType ?? CASE_TYPES[0];
  const difficulty = view.difficulty ?? 1;
  const setFilter = (t: string, d: number) => send("session:setCaseFilter", { sessionId: view.id, caseType: t, difficulty: d });
  const gateName = view.gateFor ? (view.gateFor.id === view.me.id ? "you" : view.gateFor.firstName) : "the interviewee";

  return (
    <Card className={cn("p-6", disabled && "pointer-events-none opacity-60")} aria-disabled={disabled}>
      <h2 className="text-lg font-extrabold">Pick a case</h2>
      <p className="mb-4 text-sm text-muted">Either of you can choose. Levels follow {gateName === "you" ? "your" : `${gateName}'s`} progress gates.</p>
      <Segmented label="Problem type" value={caseType} onChange={(t) => setFilter(t, difficulty)} options={CASE_TYPES.map((t) => ({ value: t, label: t }))} />
      <div className="mt-3">
        <Segmented
          label="Difficulty"
          size="sm"
          value={String(difficulty) as "1" | "2" | "3"}
          onChange={(d) => setFilter(caseType, Number(d))}
          options={DIFFICULTIES.map((d) => ({ value: String(d) as "1" | "2" | "3", label: DIFFICULTY_LABEL[d] }))}
        />
      </div>

      <div className="mt-5">
        {!view.caseType ? (
          <p className="text-sm text-faint">Choose a problem type and level to see cases.</p>
        ) : view.poolLocked ? (
          <p className="flex items-center gap-2 rounded-2xl border border-amber/40 bg-amber-soft px-4 py-3 text-sm font-bold text-amber" role="status">
            <Lock size={16} aria-hidden /> Locked for {gateName}. {unlockHint(caseType, difficulty)}.
          </p>
        ) : view.casePool.length === 0 ? (
          <p className="text-sm text-faint">No cases yet for this type and level.</p>
        ) : (
          <>
            <ul role="radiogroup" aria-label="Cases" className="space-y-2">
              {view.casePool.map((c) => {
                const selected = view.selectedCase?.id === c.id;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => send("session:selectCase", { sessionId: view.id, caseId: c.id })}
                      className={cn("flex w-full items-center justify-between rounded-2xl border-2 px-4 py-3 text-left font-bold", selected ? "border-emerald bg-emerald-soft" : "border-line bg-obsidian hover:border-line-strong")}
                    >
                      {c.title}
                      {selected && <Check size={18} className="text-emerald" aria-hidden />}
                    </button>
                  </li>
                );
              })}
            </ul>
            <Button size="sm" variant="ghost" className="mt-3" onClick={() => send("session:selectCase", { sessionId: view.id, caseId: "random" })}>
              <Shuffle size={16} aria-hidden /> Random case
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}

function ReadyBar({ view, enabled }: { view: SessionView; enabled: boolean }) {
  const toggle = () => send("session:ready", { sessionId: view.id, ready: !view.me.ready });
  const status = !view.partner
    ? "Invite a friend to begin."
    : !view.me.role
      ? "Choose roles."
      : !view.selectedCase
        ? "Pick a case."
        : view.me.ready && view.partner.ready
          ? "Starting…"
          : view.me.ready
            ? `Waiting for ${view.partner.firstName} to get ready.`
            : view.partner.ready
              ? `${view.partner.firstName} is ready.`
              : "The case starts when you're both ready.";
  return (
    <Card className="flex flex-wrap items-center justify-between gap-4 p-6">
      <p className="font-bold text-muted" role="status" aria-live="polite">
        {status}
      </p>
      <Button size="lg" variant={view.me.ready ? "secondary" : "success"} disabled={!enabled} onClick={toggle} className="min-w-40">
        {view.me.ready ? "Not ready" : "Ready"}
      </Button>
    </Card>
  );
}
