import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { getConceptProgress } from "@/server/services/home";
import { ConceptIcon } from "@/components/home/ConceptIcon";
import { Ring } from "@/components/ui/Ring";

export const metadata: Metadata = { title: "Learn" };

export default async function LearnPage() {
  const user = await requireUser();
  const concepts = await getConceptProgress(db, user.id);
  return (
    <main className="mx-auto max-w-[1100px] px-4 pb-24 pt-10 sm:px-6">
      <h1 className="text-3xl font-extrabold tracking-tight">Learn</h1>
      <p className="mt-1 text-muted">Explainers first, then adaptive quizzes. Questions you get right retire for good.</p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {concepts.map((c) => (
          <li key={c.id}>
            <Link href={`/learn/${c.slug}`} className="flex h-full flex-col rounded-[var(--radius-card)] border border-line bg-surface p-6 transition-colors hover:border-line-strong hover:bg-surface-2">
              <div className="flex items-start justify-between">
                <span className="grid size-12 place-items-center rounded-2xl bg-royal-soft text-royal-bright">
                  <ConceptIcon name={c.icon} />
                </span>
                <Ring value={c.progress} size={48} stroke={5} tone={c.progress >= 1 ? "emerald" : "royal"} label={`${Math.round(c.progress * 100)}% mastered`}>
                  <span className="text-[11px] font-extrabold tabular-nums">{Math.round(c.progress * 100)}%</span>
                </Ring>
              </div>
              <h2 className="mt-4 text-lg font-extrabold">{c.title}</h2>
              <p className="mt-1 flex-1 text-sm text-muted">{c.summary}</p>
              <p className="mt-4 text-sm font-bold text-faint">
                {c.mastered}/{c.total} mastered · {c.xp} XP
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
