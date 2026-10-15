import { CASE_TYPES, DIFFICULTIES, type CaseType, type Difficulty, type GateMode } from "@/lib/types";

/** Average rubric score that counts as solving a level "easily" (Key Decisions). */
export const UNLOCK_SCORE = 4.0;

export type GateResult = { caseType: string; difficulty: number; avgScore: number };

/** Level N+1 opens after a solved Level N case of the same type averaging ≥ 4.0 as interviewee (R25). */
export function isLevelUnlocked(results: GateResult[], caseType: string, level: number, gateMode: GateMode | string): boolean {
  if (level <= 1) return true;
  if (gateMode === "forceUnlocked") return true;
  if (gateMode === "forceLocked") return false;
  return results.some((r) => r.caseType === caseType && r.difficulty === level - 1 && r.avgScore >= UNLOCK_SCORE);
}

export type GateMap = Record<CaseType, Record<Difficulty, boolean>>;

export function gateMap(results: GateResult[], gateMode: GateMode | string): GateMap {
  return Object.fromEntries(
    CASE_TYPES.map((t) => [t, Object.fromEntries(DIFFICULTIES.map((d) => [d, isLevelUnlocked(results, t, d, gateMode)]))]),
  ) as GateMap;
}

export function unlockHint(caseType: string, level: number): string {
  return `Score ${UNLOCK_SCORE.toFixed(1)}+ on a Level ${level - 1} ${caseType} case to unlock`;
}
