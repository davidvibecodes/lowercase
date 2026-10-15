import Link from "next/link";
import { Check } from "lucide-react";
import { Ring } from "@/components/ui/Ring";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { cn } from "@/lib/cn";
import type { ConceptProgress } from "@/server/services/home";
import { ConceptIcon } from "./ConceptIcon";

/** Vertical level-node path of concepts (R8). Every node stays clickable. */
export function LearnPath({ concepts }: { concepts: ConceptProgress[] }) {
  const nextIndex = concepts.findIndex((c) => c.progress < 1);
  const done = concepts.filter((c) => c.progress >= 1).length;
  const totalXp = concepts.reduce((a, c) => a + c.xp, 0);

  return (
    <div>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-royal-bright">Track 1</p>
          <h2 className="text-2xl font-extrabold tracking-tight">Learn</h2>
        </div>
        <p className="text-sm font-bold text-muted">
          {done}/{concepts.length} mastered · {totalXp} XP
        </p>
      </div>
      <ProgressBar value={concepts.length ? concepts.reduce((a, c) => a + c.progress, 0) / concepts.length : 0} tone="royal" label="Learn track progress" />
      <ol className="relative mt-8 space-y-4">
        <span aria-hidden className="absolute bottom-8 left-[39px] top-8 w-[3px] rounded-full bg-line" />
        {concepts.map((c, i) => {
          const complete = c.progress >= 1;
          const isNext = i === nextIndex;
          return (
            <li key={c.id} className={cn("relative", i % 2 === 1 && "sm:pl-10")}>
              <Link
                href={`/learn/${c.slug}`}
                className={cn(
                  "group flex items-center gap-5 rounded-3xl border p-3 pr-5 transition-colors",
                  isNext ? "border-royal-bright/60 bg-royal-soft" : "border-transparent hover:border-line hover:bg-surface",
                )}
              >
                <Ring value={c.progress} size={56} stroke={5} tone={complete ? "emerald" : "royal"} label={`${c.mastered} of ${c.total} mastered`} className="relative z-10 rounded-full bg-obsidian">
                  {complete ? <Check size={24} className="text-emerald" aria-hidden /> : <ConceptIcon name={c.icon} size={22} className={isNext ? "text-royal-bright" : "text-muted"} />}
                </Ring>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[17px] font-extrabold">{c.title}</p>
                  <p className="truncate text-sm text-muted">
                    {c.mastered}/{c.total} mastered · {c.xp} XP
                  </p>
                </div>
                {isNext && <span className="rounded-full bg-royal px-3 py-1 text-sm font-extrabold text-white">{c.lessons ? "Continue" : "Start"}</span>}
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
