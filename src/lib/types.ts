import { z } from "zod";

export const CASE_TYPES = ["Profitability", "Revenue Growth", "Market Entry", "Pricing", "M&A"] as const;
export type CaseType = (typeof CASE_TYPES)[number];

export const DIFFICULTIES = [1, 2, 3] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
export const DIFFICULTY_LABEL: Record<Difficulty, string> = { 1: "Level 1: Easy", 2: "Level 2: Medium", 3: "Level 3: Hard" };

export const isCaseType = (v: unknown): v is CaseType => (CASE_TYPES as readonly unknown[]).includes(v);
export const isDifficulty = (v: unknown): v is Difficulty => (DIFFICULTIES as readonly unknown[]).includes(v);

export const CASE_ITEM_KINDS = ["fact", "hint", "recommendation", "observation", "given"] as const;
export type CaseItemKind = (typeof CASE_ITEM_KINDS)[number];

/** Casebank 2.0.0 vocabularies (KTD11, KTD12). */
export const FACT_CATEGORIES = ["CLARIFYING_SCOPING", "TREE_DIRECTIONAL", "TREE_ELIMINATION", "ROOT_CAUSE"] as const;
export type FactCategory = (typeof FACT_CATEGORIES)[number];

export const NODE_STATUSES = ["ACTIVE_BRANCH", "ELIMINATED_BRANCH", "ROOT_CAUSE"] as const;
export type NodeStatus = (typeof NODE_STATUSES)[number];

export const SOCIAL_STATUSES = ["PENDING", "ACCEPTED", "DECLINED", "CANCELLED"] as const;
export type SocialStatus = (typeof SOCIAL_STATUSES)[number];

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
  status: z.enum(NODE_STATUSES).default("ACTIVE_BRANCH"),
  formula: z.string().trim().max(200).nullable().optional(),
});
export type TreeNodeInput = z.input<typeof treeNodeInput>;

/** One CMS list item. Facts and recommendations carry casebank fields; references are stable tree keys (KTD11). */
export const caseItemInput = z.object({
  id: z.string().nullable(),
  text: z.string().trim().min(1, "Items can't be empty").max(2000),
  category: z.string().trim().max(80).nullable().optional(),
  nodeKey: z.string().trim().max(64).nullable().optional(),
  gatePrereqKeys: z.array(z.string().max(64)).max(20).nullable().optional(),
  gateTrigger: z.string().trim().max(1000).nullable().optional(),
  gateAntiLeak: z.string().trim().max(1000).nullable().optional(),
  gateNudge: z.string().trim().max(1000).nullable().optional(),
});
export type CaseItemInput = z.input<typeof caseItemInput>;

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
