import { Zap } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

export function StreakCard({ streak, bolts }: { streak: number; bolts: boolean[] }) {
  const todayIndex = (new Date().getDay() + 6) % 7;
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-5xl font-extrabold tabular-nums leading-none">{streak}</span>
          <Zap size={30} className={streak ? "fill-amber text-amber" : "text-faint"} aria-hidden />
        </div>
        <p className="text-right text-sm font-bold text-muted">
          {streak === 1 ? "day" : "days"} streak
          <br />
          <span className="text-faint">Keep it going today</span>
        </p>
      </div>
      <ol className="mt-6 grid grid-cols-7 gap-2" aria-label="This week's activity">
        {bolts.map((lit, i) => (
          <li key={i} className="flex flex-col items-center gap-1.5">
            <span
              className={cn(
                "grid h-10 w-full place-items-center rounded-xl border",
                lit ? "border-amber/60 bg-amber-soft" : "border-line bg-obsidian",
                i === todayIndex && !lit && "border-dashed border-line-strong",
              )}
              aria-label={`${DAYS[i]}: ${lit ? "active" : "no activity"}`}
            >
              <Zap size={18} className={lit ? "fill-amber text-amber" : "text-line-strong"} aria-hidden />
            </span>
            <span className={cn("text-xs font-bold", i === todayIndex ? "text-ink" : "text-faint")}>{DAYS[i]}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
