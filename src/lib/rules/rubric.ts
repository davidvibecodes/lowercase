export const RUBRIC_CRITERIA = [
  { key: "structure", label: "Structure & MECE framework", description: "Breaks the problem into a clear, mutually exclusive and collectively exhaustive structure." },
  { key: "hypothesis", label: "Hypothesis-driven approach", description: "States and tests hypotheses instead of asking for data at random." },
  { key: "quant", label: "Quantitative analysis", description: "Sets up and runs the math accurately and explains what the numbers mean." },
  { key: "judgment", label: "Business judgment & insight", description: "Connects findings to real business drivers and spots the root cause." },
  { key: "communication", label: "Communication & synthesis", description: "Signposts, summarizes and keeps the interviewer oriented." },
  { key: "recommendation", label: "Recommendation", description: "Ends with a clear, actionable, well-supported recommendation." },
] as const;

export type CriterionKey = (typeof RUBRIC_CRITERIA)[number]["key"];

export function averageScore(scores: number[]): number {
  return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
}

/** Null when valid; otherwise a message (R20: every criterion, 1–5). */
export function validateRubric(scores: Array<{ criterion: string; score: number; notes?: string }>): string | null {
  const keys = new Set(scores.map((s) => s.criterion));
  if (scores.length !== RUBRIC_CRITERIA.length || RUBRIC_CRITERIA.some((c) => !keys.has(c.key))) return "Score every criterion before marking the case solved";
  if (scores.some((s) => !Number.isInteger(s.score) || s.score < 1 || s.score > 5)) return "Scores must be whole numbers from 1 to 5";
  return null;
}
