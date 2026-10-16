/**
 * Casebank 2.0.0 (KTD12): the zod schema for the JSON file and its mapping
 * onto lowercase's case model. Everything is validated, every cross-reference
 * checked, before anything is written. Text is stored and rendered as plain
 * text only.
 */
import { z } from "zod";
import { validateTree } from "@/lib/rules/tree";
import { CASE_TYPES, FACT_CATEGORIES, NODE_STATUSES, type CaseType, type Difficulty, type NodeStatus } from "@/lib/types";

const id = z.string().regex(/^[A-Za-z0-9_:-]{1,64}$/, "Ids may use letters, digits, _ : - (max 64)");
const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

const factSchema = z.object({
  fact_id: id,
  fact_text: text(2000),
  fact_category: z.enum(FACT_CATEGORIES),
  mapped_node_id: id,
  source_turn_id: z.number().int().min(0).max(100_000).optional(),
  reveal_gate: z.object({
    prerequisite_node_ids: z.array(id).max(20),
    trigger_condition: optionalText(1000),
    anti_leak_rule: optionalText(1000),
    missed_fact_fallback_nudge: optionalText(1000),
  }),
});

const nodeSchema = z.object({
  node_id: id,
  label: text(200),
  parent_id: id.nullable(),
  children_ids: z.array(id).max(50),
  is_on_correct_path: z.boolean(),
  node_status: z.enum(NODE_STATUSES),
  formula_or_framework: optionalText(200),
  mapped_fact_ids: z.array(id).max(50).optional(),
});

const caseSchema = z.object({
  case_id: id,
  title: text(160),
  metadata: z.object({
    case_type: z.string().trim().min(1).max(40),
    industry: optionalText(120),
    difficulty: z.string().trim().min(1).max(20),
    source_pages: z.array(z.number().int().min(0).max(100_000)).max(200).optional(),
  }),
  problem_statement: text(4000),
  case_facts_given: z.array(text(2000)).max(100).default([]),
  extracted_case_facts: z.array(factSchema).max(200),
  issue_tree: z.object({ root_node_id: id, correct_issue_path: z.array(id).max(100), nodes: z.array(nodeSchema).min(1).max(300) }),
  recommendations: z.array(z.object({ rec_id: id, category: optionalText(80), recommendation_text: text(2000), target_node_id: id })).max(100).default([]),
  summary_takeaways: z.array(text(2000)).max(100).default([]),
  transcript: z
    .array(z.object({ turn_id: z.number().int().min(0).max(100_000), speaker: z.enum(["Interviewer", "Candidate", "interviewer", "candidate"]), text: text(10_000) }))
    .max(2000)
    .default([]),
});

export const casebankSchema = z.object({
  schema_version: z.literal("2.0.0", { message: "Only casebank schema_version 2.0.0 is supported" }),
  cases: z.array(caseSchema).min(1).max(100),
});
export type CasebankDoc = z.infer<typeof casebankSchema>;
type CasebankCase = z.infer<typeof caseSchema>;

const DIFFICULTY: Record<string, Difficulty> = { easy: 1, moderate: 2, difficult: 3 };
const CASE_TYPE_ALIASES: Record<string, CaseType> = { growth: "Revenue Growth" };

export type PlannedItem = {
  kind: "fact" | "hint" | "recommendation" | "observation" | "given";
  externalId: string;
  text: string;
  category?: string | null;
  nodeKey?: string | null;
  sourceTurn?: number | null;
  gatePrereqKeys?: string[];
  gateTrigger?: string | null;
  gateAntiLeak?: string | null;
  gateNudge?: string | null;
};

export type PlannedNode = { key: string; parentKey: string | null; label: string; isCorrectPath: boolean; status: NodeStatus; formula: string | null };

export type PlannedCase = {
  externalId: string;
  title: string;
  caseType: CaseType;
  difficulty: Difficulty;
  problemStatement: string;
  industry: string | null;
  sourcePages: number[];
  nodes: PlannedNode[];
  items: PlannedItem[];
  transcript: Array<{ speaker: "interviewer" | "candidate"; text: string }>;
};

export type CasebankPlan = { ok: true; cases: PlannedCase[] } | { ok: false; errors: string[] };

/** Parent-first node order, keeping each node's children in children_ids order. */
function orderNodes(c: CasebankCase): CasebankCase["issue_tree"]["nodes"] {
  const byId = new Map(c.issue_tree.nodes.map((n) => [n.node_id, n]));
  const out: CasebankCase["issue_tree"]["nodes"] = [];
  const seen = new Set<string>();
  const visit = (nodeId: string) => {
    const n = byId.get(nodeId);
    if (!n || seen.has(nodeId)) return;
    seen.add(nodeId);
    out.push(n);
    for (const child of n.children_ids) visit(child);
    // Children named only through parent_id still belong under this node.
    for (const other of c.issue_tree.nodes) if (other.parent_id === nodeId) visit(other.node_id);
  };
  visit(c.issue_tree.root_node_id);
  for (const n of c.issue_tree.nodes) if (!seen.has(n.node_id)) out.push(n); // reported as unreachable below
  return out;
}

function checkReferences(c: CasebankCase, errors: string[]) {
  const where = `${c.case_id}`;
  const nodeIds = new Set<string>();
  for (const n of c.issue_tree.nodes) {
    if (nodeIds.has(n.node_id)) errors.push(`${where}: node ${n.node_id} appears twice`);
    nodeIds.add(n.node_id);
  }
  const factIds = new Set<string>();
  for (const f of c.extracted_case_facts) {
    if (factIds.has(f.fact_id)) errors.push(`${where}: fact ${f.fact_id} appears twice`);
    factIds.add(f.fact_id);
  }
  const recIds = new Set<string>();
  for (const r of c.recommendations) {
    if (recIds.has(r.rec_id)) errors.push(`${where}: recommendation ${r.rec_id} appears twice`);
    recIds.add(r.rec_id);
  }
  const node = (ref: string, from: string) => !nodeIds.has(ref) && errors.push(`${where}: ${from} points at node ${ref}, which isn't in the tree`);
  if (!nodeIds.has(c.issue_tree.root_node_id)) errors.push(`${where}: root node ${c.issue_tree.root_node_id} isn't in the tree`);
  for (const n of c.issue_tree.nodes) {
    if (n.parent_id !== null) node(n.parent_id, `node ${n.node_id}'s parent`);
    for (const child of n.children_ids) node(child, `node ${n.node_id}'s child`);
    for (const fid of n.mapped_fact_ids ?? []) if (!factIds.has(fid)) errors.push(`${where}: node ${n.node_id} lists fact ${fid}, which doesn't exist`);
  }
  for (const key of c.issue_tree.correct_issue_path) node(key, "the correct issue path");
  for (const f of c.extracted_case_facts) {
    node(f.mapped_node_id, `fact ${f.fact_id}`);
    for (const p of f.reveal_gate.prerequisite_node_ids) node(p, `fact ${f.fact_id}'s prerequisite`);
  }
  for (const r of c.recommendations) node(r.target_node_id, `recommendation ${r.rec_id}`);
}

function mapCase(c: CasebankCase, errors: string[]): PlannedCase | null {
  const before = errors.length;
  const rawType = c.metadata.case_type.trim();
  const caseType = (CASE_TYPES as readonly string[]).includes(rawType) ? (rawType as CaseType) : CASE_TYPE_ALIASES[rawType.toLowerCase()];
  if (!caseType) errors.push(`${c.case_id}: case type "${rawType}" has no match in lowercase (${CASE_TYPES.join(", ")})`);
  const difficulty = DIFFICULTY[c.metadata.difficulty.trim().toLowerCase()];
  if (!difficulty) errors.push(`${c.case_id}: difficulty "${c.metadata.difficulty}" must be Easy, Moderate or Difficult`);
  checkReferences(c, errors);

  const nodes: PlannedNode[] = orderNodes(c).map((n) => ({
    key: n.node_id,
    parentKey: n.parent_id,
    label: n.label,
    isCorrectPath: n.is_on_correct_path,
    status: n.node_status,
    formula: n.formula_or_framework || null,
  }));
  if (errors.length === before) {
    const check = validateTree(nodes);
    for (const e of check.errors) errors.push(`${c.case_id}: ${e}`);
  }
  if (errors.length > before || !caseType || !difficulty) return null;

  const items: PlannedItem[] = [
    ...c.extracted_case_facts.map((f) => ({
      kind: "fact" as const,
      externalId: f.fact_id,
      text: f.fact_text,
      category: f.fact_category,
      nodeKey: f.mapped_node_id,
      sourceTurn: f.source_turn_id ?? null,
      gatePrereqKeys: f.reveal_gate.prerequisite_node_ids,
      gateTrigger: f.reveal_gate.trigger_condition || null,
      gateAntiLeak: f.reveal_gate.anti_leak_rule || null,
      gateNudge: f.reveal_gate.missed_fact_fallback_nudge || null,
    })),
    ...c.recommendations.map((r) => ({ kind: "recommendation" as const, externalId: r.rec_id, text: r.recommendation_text, category: r.category || null, nodeKey: r.target_node_id })),
    ...c.case_facts_given.map((t, i) => ({ kind: "given" as const, externalId: `given:${i + 1}`, text: t })),
    ...c.summary_takeaways.map((t, i) => ({ kind: "observation" as const, externalId: `takeaway:${i + 1}`, text: t })),
    ...deriveHints(c),
  ];

  return {
    externalId: c.case_id,
    title: c.title,
    caseType,
    difficulty,
    problemStatement: c.problem_statement,
    industry: c.metadata.industry || null,
    sourcePages: c.metadata.source_pages ?? [],
    nodes,
    items,
    transcript: [...c.transcript].sort((a, b) => a.turn_id - b.turn_id).map((t) => ({ speaker: t.speaker.toLowerCase() as "interviewer" | "candidate", text: t.text })),
  };
}

/**
 * KTD13: the casebank has no hints, so "I'm Stuck" uses the missed-fact
 * nudges. For each node on the correct path, in order, the first mapped
 * fact's nudge becomes a hint keyed by that node; repeated text is dropped.
 */
function deriveHints(c: CasebankCase): PlannedItem[] {
  const seen = new Set<string>();
  const out: PlannedItem[] = [];
  for (const nodeKey of c.issue_tree.correct_issue_path) {
    const nudge = c.extracted_case_facts.find((f) => f.mapped_node_id === nodeKey && f.reveal_gate.missed_fact_fallback_nudge?.trim())?.reveal_gate.missed_fact_fallback_nudge?.trim();
    if (!nudge || seen.has(nudge)) continue;
    seen.add(nudge);
    out.push({ kind: "hint", externalId: `hint:${nodeKey}`, text: nudge });
  }
  return out;
}

/** Parses and validates a whole file. Any error blocks the whole import. */
export function planCasebank(input: unknown): CasebankPlan {
  const parsed = casebankSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.slice(0, 20).map((i) => `${i.path.join(".") || "file"}: ${i.message}`) };
  }
  const errors: string[] = [];
  const caseIds = new Set<string>();
  for (const c of parsed.data.cases) {
    if (caseIds.has(c.case_id)) errors.push(`case ${c.case_id} appears twice`);
    caseIds.add(c.case_id);
  }
  const cases = parsed.data.cases.map((c) => mapCase(c, errors)).filter((c): c is PlannedCase => c !== null);
  return errors.length ? { ok: false, errors } : { ok: true, cases };
}
