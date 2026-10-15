import type { Metadata } from "next";
import Link from "next/link";
import { Activity, Flame, Target, Trophy } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { cn } from "@/lib/cn";
import { getAnalytics, RANGES, type Range } from "@/server/services/analytics";
import { getUserProgress } from "@/server/services/progress";
import { PerformanceMatrix } from "@/components/you/PerformanceMatrix";
import { SolvedChart } from "@/components/you/SolvedChart";

export const metadata: Metadata = { title: "You" };

const RANGE_LABEL: Record<Range, string> = { all: "All time", week: "Week", month: "Month", year: "Year" };

export default async function YouPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const user = await requireUser();
  const { range: raw } = await searchParams;
  const range: Range = RANGES.includes(raw as Range) ? (raw as Range) : "week";
  const [a, week, progress] = await Promise.all([
    getAnalytics(db, user.id, range),
    range === "week" ? null : getAnalytics(db, user.id, "week"),
    getUserProgress(db, user.id),
  ]);
  const w = week ?? a;
  const pct = (v: number | null) => (v === null ? "–" : `${Math.round(v * 100)}%`);

  return (
    <main className="mx-auto max-w-[1100px] px-4 pb-24 pt-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            {user.firstName} {user.lastName}
          </h1>
          <p className="mt-1 text-muted">@{user.username}</p>
        </div>
        <nav aria-label="Time range" className="inline-flex gap-1 rounded-2xl border border-line bg-obsidian p-1">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/you?range=${r}`}
              aria-current={r === range ? "page" : undefined}
              className={cn("rounded-xl px-3.5 py-2 text-sm font-bold", r === range ? "bg-surface-3 text-ink" : "text-muted hover:text-ink")}
            >
              {RANGE_LABEL[r]}
            </Link>
          ))}
        </nav>
      </div>

      <section className="mt-8 overflow-hidden rounded-[var(--radius-card)] border border-royal-bright/40 bg-gradient-to-br from-[#14224d] to-surface p-6 sm:p-7" aria-label="Weekly summary">
        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-royal-bright">This week</p>
        <p className="mt-2 text-2xl font-extrabold tracking-tight">
          {w.lessons} lesson{w.lessons === 1 ? "" : "s"}, {w.casesSolved} case{w.casesSolved === 1 ? "" : "s"}, {pct(w.accuracy)} accuracy
        </p>
        <p className="mt-1 text-muted">
          {progress.streak > 0 ? `${progress.streak}-day streak. ` : ""}
          {progress.weeklyXp} XP earned this week.
        </p>
      </section>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile icon={<Activity className="text-royal-bright" />} label="Activities completed" value={String(a.activities)} />
        <Tile icon={<Target className="text-emerald" />} label="Assessment accuracy" value={pct(a.accuracy)} />
        <Tile icon={<Trophy className="text-amber" />} label="Cases solved" value={String(a.casesSolved)} />
        <Tile icon={<Flame className="fill-amber text-amber" />} label="Day streak" value={String(progress.streak)} />
      </div>

      <section className="mt-6 rounded-[var(--radius-card)] border border-line bg-surface p-6">
        <h2 className="text-lg font-extrabold">Problems solved</h2>
        <p className="mb-4 text-sm text-muted">Quiz questions answered plus cases solved as interviewee · {RANGE_LABEL[range].toLowerCase()}</p>
        {a.chart.every((b) => b.solved === 0) ? (
          <p className="grid h-56 place-items-center rounded-2xl border border-dashed border-line text-sm text-faint">No activity in this range yet.</p>
        ) : (
          <SolvedChart data={a.chart} />
        )}
      </section>

      <section className="mt-6 rounded-[var(--radius-card)] border border-line bg-surface p-6">
        <h2 className="text-lg font-extrabold">Case Performance Matrix</h2>
        <p className="mb-4 text-sm text-muted">Average rubric score as interviewee, by case type and difficulty.</p>
        <PerformanceMatrix matrix={a.matrix} />
      </section>
    </main>
  );
}

function Tile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-line bg-surface p-5">
      <span aria-hidden>{icon}</span>
      <p className="mt-3 text-3xl font-extrabold tabular-nums">{value}</p>
      <p className="text-sm font-bold text-faint">{label}</p>
    </div>
  );
}
