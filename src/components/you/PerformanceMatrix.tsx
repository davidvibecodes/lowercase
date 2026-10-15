import { Lock } from "lucide-react";
import { cn } from "@/lib/cn";
import { DIFFICULTY_LABEL } from "@/lib/types";
import type { Analytics } from "@/server/services/analytics";

function tone(avg: number) {
  if (avg >= 4) return "border-emerald/50 bg-emerald-soft text-emerald";
  if (avg < 3) return "border-amber/50 bg-amber-soft text-amber";
  return "border-line-strong bg-surface-2 text-ink";
}

export function PerformanceMatrix({ matrix }: { matrix: Analytics["matrix"] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-separate border-spacing-2 text-left">
        <thead>
          <tr>
            <th scope="col" className="text-xs font-bold uppercase tracking-[0.12em] text-faint">
              Case type
            </th>
            {matrix[0].cells.map((c) => (
              <th key={c.difficulty} scope="col" className="text-center text-xs font-bold uppercase tracking-[0.12em] text-faint">
                {DIFFICULTY_LABEL[c.difficulty]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row) => (
            <tr key={row.caseType}>
              <th scope="row" className="pr-2 font-extrabold">
                {row.caseType}
              </th>
              {row.cells.map((c) => (
                <td
                  key={c.difficulty}
                  className={cn("h-16 rounded-2xl border text-center", c.avgScore !== null ? tone(c.avgScore) : "border-line bg-obsidian text-faint")}
                  aria-label={`${row.caseType} ${DIFFICULTY_LABEL[c.difficulty]}: ${c.avgScore !== null ? `${c.avgScore.toFixed(1)} average over ${c.count}` : c.unlocked ? "no cases yet" : "locked"}`}
                >
                  {c.avgScore !== null ? (
                    <span>
                      <span className="block text-lg font-extrabold tabular-nums">{c.avgScore.toFixed(1)}</span>
                      <span className="block text-xs font-bold opacity-80">
                        {c.count} case{c.count === 1 ? "" : "s"}
                      </span>
                    </span>
                  ) : c.unlocked ? (
                    "—"
                  ) : (
                    <Lock size={16} className="mx-auto" aria-hidden />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
