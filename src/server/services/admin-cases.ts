import { z } from "zod";
import type { CaseItem } from "@prisma/client";
import type { Db } from "@/lib/db";
import { itemNodeKeys, keysFromJson, keysToJson } from "@/lib/node-keys";
import { validateTree } from "@/lib/rules/tree";
import { caseInput, caseItemInput, CASE_ITEM_KINDS, transcriptTurnInput, treeNodeInput, type CaseItemKind } from "@/lib/types";
import { writeTree } from "@/server/seed-runner";
import { parseInput, ServiceError } from "./invites";

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

const parse = parseInput;

export async function createCase(db: Db, input: unknown) {
  return db.case.create({ data: parse(caseInput, input) });
}

export async function updateCaseMeta(db: Db, id: string, input: unknown) {
  await db.case.update({ where: { id }, data: parse(caseInput, input) });
}

const itemsInput = z.array(caseItemInput);

/** Kinds that carry casebank fields; other lists store text only. */
const RICH_KINDS: Partial<Record<CaseItemKind, "fact" | "recommendation">> = { fact: "fact", recommendation: "recommendation" };

export type SavedCaseItem = {
  id: string;
  text: string;
  category: string | null;
  nodeKey: string | null;
  gatePrereqKeys: string[];
  gateTrigger: string | null;
  gateAntiLeak: string | null;
  gateNudge: string | null;
};

/** Only the editor's fields leave the server; ids, kinds and import metadata stay behind. */
export function toSavedItem(i: Pick<CaseItem, "id" | "text" | "category" | "nodeKey" | "gatePrereqKeys" | "gateTrigger" | "gateAntiLeak" | "gateNudge">): SavedCaseItem {
  return {
    id: i.id,
    text: i.text,
    category: i.category,
    nodeKey: i.nodeKey,
    gatePrereqKeys: keysFromJson(i.gatePrereqKeys),
    gateTrigger: i.gateTrigger,
    gateAntiLeak: i.gateAntiLeak,
    gateNudge: i.gateNudge,
  };
}

/** Every live fact and recommendation that points into the tree, for validateTree (R25). */
async function treeReferences(db: Db, caseId: string) {
  const items = await db.caseItem.findMany({
    where: { caseId, archivedAt: null, kind: { in: ["fact", "recommendation"] } },
    select: { text: true, nodeKey: true, gatePrereqKeys: true },
  });
  return items
    .map((i) => ({ label: i.text.length > 60 ? `${i.text.slice(0, 57)}...` : i.text, keys: itemNodeKeys(i.nodeKey, keysFromJson(i.gatePrereqKeys)) }))
    .filter((r) => r.keys.length > 0);
}

/**
 * Saves one ordered list (facts, hints, …) by diffing ids: edits update in
 * place, new items insert, removed items are archived (not deleted) so past
 * reveal and hint records stay valid (U15). Facts and recommendations also
 * save their casebank fields; their node keys must exist in the tree.
 */
export async function saveCaseItems(db: Db, caseId: string, kind: string, input: unknown): Promise<SavedCaseItem[]> {
  if (!CASE_ITEM_KINDS.includes(kind as CaseItemKind)) throw new ServiceError("Unknown list");
  const items = parse(itemsInput, input);
  const rich = RICH_KINDS[kind as CaseItemKind];
  if (rich) {
    const keys = new Set((await db.issueTreeNode.findMany({ where: { caseId }, select: { key: true } })).map((n) => n.key));
    for (const item of items) {
      const refs = itemNodeKeys(item.nodeKey, item.gatePrereqKeys ?? []);
      const missing = refs.find((k) => !keys.has(k));
      if (missing) throw new ServiceError(`"${item.text.slice(0, 40)}" points at a node that isn't in the tree`);
    }
  }
  const fields = (item: (typeof items)[number]) =>
    rich
      ? {
          category: item.category || null,
          nodeKey: item.nodeKey || null,
          gatePrereqKeys: rich === "fact" ? keysToJson(item.gatePrereqKeys) : null,
          gateTrigger: rich === "fact" ? item.gateTrigger || null : null,
          gateAntiLeak: rich === "fact" ? item.gateAntiLeak || null : null,
          gateNudge: rich === "fact" ? item.gateNudge || null : null,
        }
      : {};
  const existing = await db.caseItem.findMany({ where: { caseId, kind, archivedAt: null } });
  const keep = new Set(items.filter((i) => i.id).map((i) => i.id!));
  await db.$transaction([
    ...existing.filter((e) => !keep.has(e.id)).map((e) => db.caseItem.update({ where: { id: e.id }, data: { archivedAt: new Date() } })),
    ...items.map((item, order) =>
      item.id && existing.some((e) => e.id === item.id)
        ? db.caseItem.update({ where: { id: item.id }, data: { text: item.text, order, ...fields(item) } })
        : db.caseItem.create({ data: { caseId, kind, text: item.text, order, ...fields(item) } }),
    ),
  ]);
  // The saved list with real ids, so the editor's next save updates rather than re-creates.
  const saved = await db.caseItem.findMany({ where: { caseId, kind, archivedAt: null }, orderBy: { order: "asc" } });
  return saved.map(toSavedItem);
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
  const check = validateTree(nodes, await treeReferences(db, caseId));
  if (check.errors.length) throw new ServiceError(check.errors[0]);
  await db.$transaction(async (tx) => {
    await tx.issueTreeNode.deleteMany({ where: { caseId } });
    await writeTree(tx, caseId, nodes);
  });
  return check.warnings;
}

export async function deleteCase(db: Db, id: string) {
  // A live session would be left with no case to render; unpublish instead.
  const live = await db.caseSession.count({ where: { caseId: id, status: { in: ["LOBBY", "ACTIVE", "SOLVED"] } } });
  if (live) throw new ServiceError("This case is in use by an open session. Unpublish it instead, or delete it once the session ends.");
  await db.case.delete({ where: { id } });
}

export { splitTranscript } from "@/lib/transcript";
