"use client";

import { useState } from "react";
import { Shield } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Tabs";
import { cn } from "@/lib/cn";
import type { Standing } from "@/lib/rules/league";
import { standingsWindow } from "@/lib/rules/league";

type Props = {
  userId: string;
  league: { name: string; daysLeft: number; standings: Standing[] };
  groups: Array<{ id: string; name: string; standings: Standing[] }>;
};

function Rows({ rows, userId }: { rows: Standing[]; userId: string }) {
  return (
    <ol className="space-y-1.5">
      {rows.map((r) => {
        const me = r.id === userId;
        return (
          <li
            key={r.id}
            aria-current={me ? "true" : undefined}
            className={cn("flex items-center rounded-2xl px-4 py-3 text-[15px]", me ? "bg-royal font-extrabold text-white" : "text-muted")}
          >
            <span className={cn("w-10 tabular-nums", !me && "text-faint")}>{r.rank}</span>
            <span className="flex-1 truncate font-bold">{r.name}</span>
            <span className="tabular-nums">
              {r.weeklyXp} <span className="text-xs">XP</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function LeagueCard({ userId, league, groups }: Props) {
  const [tab, setTab] = useState<"global" | "groups">("global");
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const group = groups.find((g) => g.id === groupId);

  return (
    <Card className="p-6">
      <Segmented
        label="Leaderboard"
        size="sm"
        value={tab}
        onChange={setTab}
        options={[
          { value: "global", label: "Global League" },
          { value: "groups", label: "My Study Groups" },
        ]}
      />
      {tab === "global" ? (
        <>
          <div className="mt-5 flex items-center gap-4">
            <span className="grid size-14 place-items-center rounded-2xl border border-line-strong bg-gradient-to-b from-surface-3 to-surface-2">
              <Shield size={28} className="text-muted" aria-hidden />
            </span>
            <div>
              <p className="font-extrabold uppercase tracking-wide">{league.name} League</p>
              <p className="text-sm text-muted">
                Top 15 advance · {league.daysLeft === 0 ? "ends today" : `${league.daysLeft} day${league.daysLeft === 1 ? "" : "s"} left`}
              </p>
            </div>
          </div>
          <div className="mt-5">
            <Rows rows={standingsWindow(league.standings, userId)} userId={userId} />
          </div>
        </>
      ) : group ? (
        <div className="mt-5">
          {groups.length > 1 ? (
            <label className="mb-3 block">
              <span className="sr-only">Study group</span>
              <select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className="h-10 w-full rounded-xl border border-line bg-obsidian px-3 font-bold text-ink"
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="mb-3 font-extrabold">{group.name}</p>
          )}
          <Rows rows={group.standings} userId={userId} />
        </div>
      ) : (
        <p className="mt-5 text-sm text-muted">You&apos;re not in a study group yet. Create one from Friends &amp; Groups.</p>
      )}
    </Card>
  );
}
