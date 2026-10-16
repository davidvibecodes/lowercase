import type { Prisma } from "@prisma/client";
import type { Db } from "@/lib/db";
import { planCasebank, type PlannedCase } from "@/lib/casebank";
import { keysToJson } from "@/lib/node-keys";
import type { CaseItemKind } from "@/lib/types";
import { writeTree } from "@/server/seed-runner";

/**
 * Imports a 2.0.0 casebank (KTD12). Cases upsert on their casebank id; items
 * upsert on (kind, casebank id) so reveal and hint history keeps pointing at
 * the same rows; items missing from the file are archived, never deleted.
 * Each case is its own transaction, so one failure can't half-write another.
 */

/** The item kinds an import owns. Listed on purpose: a kind added to the CMS later isn't archived by re-imports. */
const IMPORTED_KINDS = ["fact", "hint", "recommendation", "observation", "given"] as const satisfies readonly CaseItemKind[];

export type CaseCounts = { facts: number; nodes: number; recommendations: number; hints: number; given: number; takeaways: number; turns: number };

export type CasePreview = {
  externalId: string;
  title: string;
  action: "create" | "update";
  /** Why Confirm would refuse this case, e.g. a session in progress. */
  blocked: string | null;
  counts: CaseCounts;
};

export type CaseOutcome = { externalId: string; title: string; status: "applied" | "failed"; reason?: string };

export type ImportResult =
  | { ok: true; dryRun: boolean; cases: CasePreview[]; outcomes: CaseOutcome[] }
  | { ok: false; errors: string[] };

const IN_PROGRESS = "A live session is using this case. Finish or close it, then import again.";

function counts(c: PlannedCase): CaseCounts {
  const n = (kind: string) => c.items.filter((i) => i.kind === kind).length;
  return { facts: n("fact"), nodes: c.nodes.length, recommendations: n("recommendation"), hints: n("hint"), given: n("given"), takeaways: n("observation"), turns: c.transcript.length };
}

function hasActiveSession(client: Db | Prisma.TransactionClient, caseId: string) {
  return client.caseSession.count({ where: { caseId, status: "ACTIVE" } }).then((n) => n > 0);
}

/** Create/update and blocked status for every case, in two queries however many cases the file has. */
async function previewAll(db: Db, cases: PlannedCase[]): Promise<CasePreview[]> {
  const existing = await db.case.findMany({ where: { externalId: { in: cases.map((c) => c.externalId) } }, select: { id: true, externalId: true } });
  const idByExternal = new Map(existing.map((e) => [e.externalId, e.id]));
  const active = await db.caseSession.groupBy({ by: ["caseId"], where: { caseId: { in: existing.map((e) => e.id) }, status: "ACTIVE" } });
  const busy = new Set(active.map((a) => a.caseId));
  return cases.map((c) => {
    const id = idByExternal.get(c.externalId);
    return { externalId: c.externalId, title: c.title, action: id ? "update" : "create", blocked: id && busy.has(id) ? IN_PROGRESS : null, counts: counts(c) };
  });
}

async function applyCase(db: Db, c: PlannedCase): Promise<void> {
  await db.$transaction(
    async (tx) => {
      const data = {
        title: c.title,
        caseType: c.caseType,
        difficulty: c.difficulty,
        problemStatement: c.problemStatement,
        industry: c.industry,
        sourcePages: c.sourcePages.length ? JSON.stringify(c.sourcePages) : null,
        published: true,
      };
      const existing = await tx.case.findUnique({ where: { externalId: c.externalId }, select: { id: true } });
      // Checked again inside the transaction: a session may have started since the preview.
      if (existing && (await hasActiveSession(tx, existing.id))) throw new Error(IN_PROGRESS);
      const row = existing
        ? await tx.case.update({ where: { id: existing.id }, data })
        : await tx.case.create({ data: { ...data, externalId: c.externalId } });

      // Nothing in session history references tree nodes or transcript turns, so both are replaced.
      await tx.issueTreeNode.deleteMany({ where: { caseId: row.id } });
      await writeTree(tx, row.id, c.nodes);
      await tx.transcriptTurn.deleteMany({ where: { caseId: row.id } });
      if (c.transcript.length) await tx.transcriptTurn.createMany({ data: c.transcript.map((t, order) => ({ caseId: row.id, order, speaker: t.speaker, text: t.text })) });

      const current = await tx.caseItem.findMany({ where: { caseId: row.id, kind: { in: [...IMPORTED_KINDS] } } });
      const keep = new Set<string>();
      for (const kind of IMPORTED_KINDS) {
        const planned = c.items.filter((i) => i.kind === kind);
        for (const [order, item] of planned.entries()) {
          const fields = {
            text: item.text,
            order,
            archivedAt: null,
            category: item.category ?? null,
            nodeKey: item.nodeKey ?? null,
            sourceTurn: item.sourceTurn ?? null,
            gatePrereqKeys: keysToJson(item.gatePrereqKeys),
            gateTrigger: item.gateTrigger ?? null,
            gateAntiLeak: item.gateAntiLeak ?? null,
            gateNudge: item.gateNudge ?? null,
          };
          const match = current.find((x) => x.kind === kind && x.externalId === item.externalId);
          const saved = match
            ? await tx.caseItem.update({ where: { id: match.id }, data: fields })
            : await tx.caseItem.create({ data: { caseId: row.id, kind, externalId: item.externalId, ...fields } });
          keep.add(saved.id);
        }
      }
      // Items gone from the file (including CMS-added ones of these kinds) are archived, never deleted.
      const stale = current.filter((x) => !x.archivedAt && !keep.has(x.id)).map((x) => x.id);
      if (stale.length) await tx.caseItem.updateMany({ where: { id: { in: stale } }, data: { archivedAt: new Date() } });
    },
    { timeout: 60_000, maxWait: 10_000 },
  );
}

export async function importCasebank(db: Db, doc: unknown, opts: { dryRun: boolean }): Promise<ImportResult> {
  const plan = planCasebank(doc);
  if (!plan.ok) return plan;
  const cases = await previewAll(db, plan.cases);
  if (opts.dryRun) return { ok: true, dryRun: true, cases, outcomes: [] };

  const outcomes: CaseOutcome[] = [];
  for (const c of plan.cases) {
    try {
      await applyCase(db, c);
      outcomes.push({ externalId: c.externalId, title: c.title, status: "applied" });
    } catch (e) {
      outcomes.push({ externalId: c.externalId, title: c.title, status: "failed", reason: e instanceof Error && e.message === IN_PROGRESS ? IN_PROGRESS : "Couldn't save this case. Try again." });
    }
  }
  return { ok: true, dryRun: false, cases, outcomes };
}
