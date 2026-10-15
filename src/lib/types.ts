import { z } from "zod";

export const CASE_TYPES = ["Profitability", "Revenue Growth", "Market Entry", "Pricing", "M&A"] as const;
export type CaseType = (typeof CASE_TYPES)[number];

export const DIFFICULTIES = [1, 2, 3] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
export const DIFFICULTY_LABEL: Record<Difficulty, string> = { 1: "Level 1: Easy", 2: "Level 2: Medium", 3: "Level 3: Hard" };

export const CASE_ITEM_KINDS = ["fact", "hint", "recommendation", "observation"] as const;
export type CaseItemKind = (typeof CASE_ITEM_KINDS)[number];

export const SPEAKERS = ["interviewer", "candidate"] as const;
export type Speaker = (typeof SPEAKERS)[number];

export const QUESTION_KINDS = ["concept", "application"] as const;
export type QuestionKind = (typeof QUESTION_KINDS)[number];

export const GATE_MODES = ["auto", "forceUnlocked", "forceLocked"] as const;
export type GateMode = (typeof GATE_MODES)[number];

export const SESSION_STATUSES = ["LOBBY", "ACTIVE", "SOLVED", "CLOSED"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const INVITE_STATUSES = ["PENDING", "ACCEPTED", "DECLINED", "CANCELLED", "EXPIRED"] as const;
export type InviteStatus = (typeof INVITE_STATUSES)[number];

export type Role = "interviewer" | "interviewee";

/* ---------- content schemas shared by the seed and the CMS ---------- */

export const optionInput = z.object({ text: z.string().trim().min(1, "Option text is required"), isCorrect: z.boolean() });

export const questionInput = z
  .object({
    kind: z.enum(QUESTION_KINDS),
    prompt: z.string().trim().min(1, "Question prompt is required"),
    scenario: z.string().trim().optional().nullable(),
    explanation: z.string().trim().min(1, "Explanation is required"),
    options: z.array(optionInput).min(2, "Add at least two options"),
  })
  .refine((q) => q.options.filter((o) => o.isCorrect).length === 1, {
    message: "Mark exactly one option as correct",
    path: ["options"],
  });
export type QuestionInput = z.infer<typeof questionInput>;

export const explainerInput = z.object({ title: z.string().trim().min(1, "Title is required"), body: z.string().trim().min(1, "Body is required") });
export type ExplainerInput = z.infer<typeof explainerInput>;

export const conceptInput = z.object({
  slug: z.string().trim().min(1).regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and dashes"),
  title: z.string().trim().min(1, "Title is required"),
  summary: z.string().trim().min(1, "Summary is required"),
  icon: z.string().trim().default("sparkles"),
  published: z.boolean().default(true),
});
export type ConceptInput = z.infer<typeof conceptInput>;

export const treeNodeInput = z.object({
  key: z.string(),
  parentKey: z.string().nullable(),
  label: z.string(),
  isCorrectPath: z.boolean(),
});
export type TreeNodeInput = z.infer<typeof treeNodeInput>;

export const transcriptTurnInput = z.object({ speaker: z.enum(SPEAKERS), text: z.string().trim().min(1) });

export const caseInput = z.object({
  title: z.string().trim().min(1, "Title is required"),
  caseType: z.enum(CASE_TYPES),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  problemStatement: z.string().trim().min(1, "Problem statement is required"),
  published: z.boolean().default(true),
});
export type CaseInput = z.infer<typeof caseInput>;

/** Seed shape for a full case; the CMS writes the same pieces. */
export type CaseSeed = CaseInput & {
  facts: string[];
  hints: string[];
  recommendations: string[];
  observations: string[];
  transcript: Array<{ speaker: Speaker; text: string }>;
  tree: TreeNodeInput[];
};

export type ConceptSeed = ConceptInput & {
  explainers: ExplainerInput[];
  questions: QuestionInput[];
};
