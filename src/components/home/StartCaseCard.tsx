"use client";

import { useState, useTransition } from "react";
import { Lock, Play } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Tabs";
import { createLobbyAction } from "@/app/(app)/actions";
import { cn } from "@/lib/cn";
import { unlockHint } from "@/lib/rules/gates";
import { DIFFICULTY_LABEL, type CaseType, type Difficulty } from "@/lib/types";
import type { CaseAvailability } from "@/server/services/home";

export function StartCaseCard({ availability }: { availability: CaseAvailability }) {
  const [caseType, setCaseType] = useState<CaseType>(availability[0].caseType);
  const [difficulty, setDifficulty] = useState<Difficulty>(1);
  const [pending, start] = useTransition();
  const levels = availability.find((a) => a.caseType === caseType)!.levels;
  const current = levels.find((l) => l.difficulty === difficulty)!;
  const blocked = !current.unlocked || current.cases === 0;

  const pickType = (t: CaseType) => {
    setCaseType(t);
    const lv = availability.find((a) => a.caseType === t)!.levels;
    if (!lv.find((l) => l.difficulty === difficulty)?.unlocked) setDifficulty(1);
  };

  return (
    <Card className="p-6 sm:p-7">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald">Track 2</p>
      <h2 className="text-2xl font-extrabold tracking-tight">Start a Case Session</h2>
      <p className="mt-1 text-sm text-muted">Pick a problem type and level, then invite a friend from the lobby. No warm-up needed.</p>

      <p className="mb-2 mt-6 text-sm font-bold text-muted">Problem type</p>
      <Segmented label="Problem type" value={caseType} onChange={pickType} options={availability.map((a) => ({ value: a.caseType, label: a.caseType }))} />

      <p className="mb-2 mt-5 text-sm font-bold text-muted">Difficulty</p>
      <div role="radiogroup" aria-label="Difficulty" className="grid gap-2 sm:grid-cols-3">
        {levels.map((l) => {
          const active = l.difficulty === difficulty;
          return (
            <button
              key={l.difficulty}
              type="button"
              role="radio"
              aria-checked={active}
              aria-disabled={!l.unlocked}
              disabled={!l.unlocked}
              title={l.unlocked ? undefined : unlockHint(caseType, l.difficulty)}
              onClick={() => setDifficulty(l.difficulty)}
              data-testid={`level-${l.difficulty}`}
              className={cn(
                "rounded-2xl border px-4 py-3 text-left transition-colors",
                active ? "border-emerald bg-emerald-soft" : "border-line bg-obsidian hover:border-line-strong",
                !l.unlocked && "cursor-not-allowed opacity-60 hover:border-line",
              )}
            >
              <span className="flex items-center justify-between font-extrabold">
                {DIFFICULTY_LABEL[l.difficulty]}
                {!l.unlocked && <Lock size={16} className="text-amber" aria-label="Locked" />}
              </span>
              <span className="mt-0.5 block text-xs text-muted">
                {!l.unlocked ? unlockHint(caseType, l.difficulty) : l.cases === 0 ? "No cases yet" : `${l.cases} case${l.cases === 1 ? "" : "s"}`}
              </span>
            </button>
          );
        })}
      </div>

      <Button
        size="lg"
        block
        className="mt-6"
        disabled={blocked || pending}
        onClick={() => start(() => createLobbyAction(caseType, difficulty))}
      >
        <Play size={18} className="fill-current" aria-hidden /> {current.cases === 0 && current.unlocked ? "No cases yet" : "Start Session"}
      </Button>
    </Card>
  );
}
