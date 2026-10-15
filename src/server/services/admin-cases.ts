import { z } from "zod";
import type { Db } from "@/lib/db";
import { validateTree } from "@/lib/rules/tree";
import { caseInput, CASE_ITEM_KINDS, transcriptTurnInput, treeNodeInput, type CaseItemKind } from "@/lib/types";
import { writeTree } from "@/server/seed-runner";
import { ServiceError } from "./invites";

export async function listCasesAdmin(db: Db) {
  return db.case.findMany({
    orderBy: [{ caseType: "asc" }, { difficulty: "asc" }, { title: "asc" }],
    include: { _count: { select: { nodes: true, transcript: true } } },
  });
}

export async function getCaseAdmin(db: Db, id: string) {
  return db.case.findUnique({
    where: { id },
    include: {
      items: { where: { archivedAt: null }, orderBy: { order: "asc" } },
      transcript: { orderBy: { order: "asc" } },
      nodes: { orderBy: { order: "asc" } },
    },
  });
}

function parse<T>(schema: z.ZodType<T>, v: unknown): T {
  const r = schema.safeParse(v);
  if (!r.success) throw new ServiceError(r.error.issues[0]?.message ?? "Invalid input");
  return r.data;
}

export async function createCase(db: Db, input: unknown) {
  return db.case.create({ data: parse(caseInput, input) });
}

export async function updateCaseMeta(db: Db, id: string, input: unknown) {
  await db.case.update({ where: { id }, data: parse(caseInput, input) });
}

const itemsInput = z.array(z.object({ id: z.string().nullable(), text: z.string().trim().min(1, "Items can't be empty") }));

/**
 * Saves one ordered list (facts, hints, …) by diffing ids: edits update in
 * place, new items insert, removed items are archived (not deleted) so past
 * reveal and hint records stay valid (U15).
 */
export async function saveCaseItems(db: Db, caseId: string, kind: string, input: unknown) {
  if (!CASE_ITEM_KINDS.includes(kind as CaseItemKind)) throw new ServiceError("Unknown list");
  const items = parse(itemsInput, input);
  const existing = await db.caseItem.findMany({ where: { caseId, kind, archivedAt: null } });
  const keep = new Set(items.filter((i) => i.id).map((i) => i.id!));
  await db.$transaction([
    ...existing.filter((e) => !keep.has(e.id)).map((e) => db.caseItem.update({ where: { id: e.id }, data: { archivedAt: new Date() } })),
    ...items.map((item, order) =>
      item.id && existing.some((e) => e.id === item.id)
        ? db.caseItem.update({ where: { id: item.id }, data: { text: item.text, order } })
        : db.caseItem.create({ data: { caseId, kind, text: item.text, order } }),
    ),
  ]);
}

export async function saveTranscript(db: Db, caseId: string, input: unknown) {
  const turns = parse(z.array(transcriptTurnInput), input);
  await db.$transaction([
    db.transcriptTurn.deleteMany({ where: { caseId } }),
    ...turns.map((t, order) => db.transcriptTurn.create({ data: { caseId, order, speaker: t.speaker, text: t.text } })),
  ]);
}

/** Replaces the tree in one transaction (KTD7). Returns non-blocking warnings. */
export async function saveTree(db: Db, caseId: string, input: unknown) {
  const nodes = parse(z.array(treeNodeInput), input);
  const check = validateTree(nodes);
  if (check.errors.length) throw new ServiceError(check.errors[0]);
  await db.$transaction(async (tx) => {
    await tx.issueTreeNode.deleteMany({ where: { caseId } });
    await writeTree(tx, caseId, nodes);
  });
  return check.warnings;
}

export async function deleteCase(db: Db, id: string) {
  await db.case.delete({ where: { id } });
}

export { splitTranscript } from "@/lib/transcript";
