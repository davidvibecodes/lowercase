import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { importCasebank } from "@/server/services/casebank";
import { db, resetAndSeed, userId } from "./helpers/db";

const fixture = () => JSON.parse(readFileSync(resolve(import.meta.dirname, "../fixtures/casebank-sample.json"), "utf8"));

async function caseByExternal(externalId: string) {
  return db.case.findUniqueOrThrow({
    where: { externalId },
    include: { items: { orderBy: { order: "asc" } }, nodes: true, transcript: { orderBy: { order: "asc" } } },
  });
}

const live = <T extends { kind: string; archivedAt: Date | null }>(items: T[], kind: string) => items.filter((i) => i.kind === kind && !i.archivedAt);

beforeEach(async () => {
  await resetAndSeed();
});

describe("importCasebank (R24, KTD12)", () => {
  it("creates both cases with every part mapped", async () => {
    const r = await importCasebank(db, fixture(), { dryRun: false });
    expect(r.ok && r.outcomes.map((o) => o.status)).toEqual(["applied", "applied"]);
    const bakery = await caseByExternal("SAMPLE_001");
    expect(bakery).toMatchObject({ title: "Corner Bakery", caseType: "Profitability", difficulty: 2, industry: "Food retail", sourcePages: "[1,2]", published: true });
    expect(live(bakery.items, "fact")).toHaveLength(3);
    expect(live(bakery.items, "recommendation")).toHaveLength(1);
    expect(live(bakery.items, "given").map((i) => i.text)).toEqual(["Profits fell by half over twelve months", "Flour prices rose sharply"]);
    expect(live(bakery.items, "observation")).toHaveLength(1);
    expect(bakery.nodes).toHaveLength(4);
    expect(bakery.transcript.map((t) => t.speaker)).toEqual(["interviewer", "candidate"]);
    const rootCause = bakery.items.find((i) => i.externalId === "F_S1_03")!;
    expect(rootCause).toMatchObject({ category: "ROOT_CAUSE", nodeKey: "N_S1_FLOUR", gatePrereqKeys: '["N_S1_COST"]', gateAntiLeak: null, sourceTurn: 6 });
    expect(bakery.nodes.find((n) => n.key === "N_S1_FLOUR")).toMatchObject({ status: "ROOT_CAUSE", isCorrectPath: true });
    expect(bakery.nodes.find((n) => n.key === "N_S1_ROOT")?.formula).toBe("Profit = Revenue - Cost");
    expect((await caseByExternal("SAMPLE_002")).caseType).toBe("Revenue Growth");
  });

  it("derives I'm Stuck hints from the correct path's nudges, in path order (KTD13)", async () => {
    await importCasebank(db, fixture(), { dryRun: false });
    const hints = live((await caseByExternal("SAMPLE_001")).items, "hint");
    expect(hints.map((h) => [h.externalId, h.text])).toEqual([
      ["hint:N_S1_ROOT", "Which side of the profit equation moved?"],
      ["hint:N_S1_COST", "Have you looked at what goes into each loaf?"],
      ["hint:N_S1_FLOUR", "How does the bakery buy its flour?"],
    ]);
  });

  it("covers AE5: re-importing updates in place, keeps ids and session history", async () => {
    await importCasebank(db, fixture(), { dryRun: false });
    const first = await caseByExternal("SAMPLE_001");
    const fact = first.items.find((i) => i.externalId === "F_S1_02")!;
    const hint = first.items.find((i) => i.kind === "hint")!;
    const s = await db.caseSession.create({ data: { hostId: await userId("roy"), guestId: await userId("ankit"), caseId: first.id, status: "SOLVED" } });
    await db.sessionReveal.create({ data: { sessionId: s.id, round: 1, caseItemId: fact.id } });
    await db.sessionHintUse.create({ data: { sessionId: s.id, round: 1, caseItemId: hint.id } });

    const again = await importCasebank(db, fixture(), { dryRun: false });
    expect(again.ok && again.cases.map((c) => c.action)).toEqual(["update", "update"]);
    const second = await caseByExternal("SAMPLE_001");
    expect(second.id).toBe(first.id);
    expect(second.items.map((i) => i.id).sort()).toEqual(first.items.map((i) => i.id).sort());
    expect(await db.sessionReveal.count({ where: { caseItemId: fact.id } })).toBe(1);
    expect(await db.sessionHintUse.count({ where: { caseItemId: hint.id } })).toBe(1);
    expect(await db.case.count({ where: { externalId: { not: null } } })).toBe(2);
  });

  it("archives a removed fact, and restores the same row when it comes back", async () => {
    await importCasebank(db, fixture(), { dryRun: false });
    const original = (await caseByExternal("SAMPLE_001")).items.find((i) => i.externalId === "F_S1_01")!;
    const without = fixture();
    without.cases[0].extracted_case_facts = without.cases[0].extracted_case_facts.filter((f: { fact_id: string }) => f.fact_id !== "F_S1_01");
    without.cases[0].issue_tree.nodes[0].mapped_fact_ids = [];
    await importCasebank(db, without, { dryRun: false });
    expect((await db.caseItem.findUniqueOrThrow({ where: { id: original.id } })).archivedAt).not.toBeNull();
    await importCasebank(db, fixture(), { dryRun: false });
    expect(await db.caseItem.findUniqueOrThrow({ where: { id: original.id } })).toMatchObject({ archivedAt: null, kind: "fact" });
  });

  it("moves an id between kinds by archiving the old row, which keeps its reveal", async () => {
    await importCasebank(db, fixture(), { dryRun: false });
    const asFact = (await caseByExternal("SAMPLE_001")).items.find((i) => i.externalId === "F_S1_02")!;
    const s = await db.caseSession.create({ data: { hostId: await userId("roy"), caseId: asFact.caseId, status: "SOLVED" } });
    await db.sessionReveal.create({ data: { sessionId: s.id, round: 1, caseItemId: asFact.id } });
    const moved = fixture();
    const c = moved.cases[0];
    c.extracted_case_facts = c.extracted_case_facts.filter((f: { fact_id: string }) => f.fact_id !== "F_S1_02");
    c.issue_tree.nodes[2].mapped_fact_ids = [];
    c.recommendations.push({ rec_id: "F_S1_02", category: null, recommendation_text: "Now a recommendation", target_node_id: "N_S1_COST" });
    await importCasebank(db, moved, { dryRun: false });
    expect((await db.caseItem.findUniqueOrThrow({ where: { id: asFact.id } })).archivedAt).not.toBeNull();
    expect(await db.sessionReveal.count({ where: { caseItemId: asFact.id } })).toBe(1);
    expect(await db.caseItem.count({ where: { externalId: "F_S1_02", kind: "recommendation", archivedAt: null } })).toBe(1);
  });

  it("keeps hint uses and the count after a re-import once the round is solved", async () => {
    await importCasebank(db, fixture(), { dryRun: false });
    const bakery = await caseByExternal("SAMPLE_001");
    const usedHint = bakery.items.find((i) => i.kind === "hint")!;
    const s = await db.caseSession.create({ data: { hostId: await userId("roy"), caseId: bakery.id, status: "SOLVED" } });
    await db.sessionHintUse.create({ data: { sessionId: s.id, round: 1, caseItemId: usedHint.id } });
    await importCasebank(db, fixture(), { dryRun: false });
    expect(await db.sessionHintUse.findMany({ where: { sessionId: s.id } })).toHaveLength(1);
    expect((await db.caseItem.findUniqueOrThrow({ where: { id: usedHint.id } })).archivedAt).toBeNull();
  });

  it("refuses to update a case with an ACTIVE session, previews it as blocked, and still applies the others", async () => {
    await importCasebank(db, fixture(), { dryRun: false });
    const bakery = await caseByExternal("SAMPLE_001");
    await db.caseSession.create({ data: { hostId: await userId("roy"), caseId: bakery.id, status: "ACTIVE" } });
    const dry = await importCasebank(db, fixture(), { dryRun: true });
    expect(dry.ok && dry.cases.map((c) => Boolean(c.blocked))).toEqual([true, false]);
    const r = await importCasebank(db, fixture(), { dryRun: false });
    expect(r.ok && r.outcomes.map((o) => o.status)).toEqual(["failed", "applied"]);
    expect(r.ok && r.outcomes[0].reason).toMatch(/live session/);
  });

  it("a failure in one case leaves the others committed, and a re-run converges", async () => {
    const broken = fixture();
    // Case 2 fails to write because a live session is using it; case 1 must still commit.
    await db.case.create({ data: { title: "Squatter", caseType: "Pricing", difficulty: 1, problemStatement: "x", externalId: "SAMPLE_002" } });
    await db.caseSession.create({ data: { hostId: await userId("roy"), caseId: (await caseByExternal("SAMPLE_002")).id, status: "ACTIVE" } });
    const r = await importCasebank(db, broken, { dryRun: false });
    expect(r.ok && r.outcomes.map((o) => o.status)).toEqual(["applied", "failed"]);
    expect((await caseByExternal("SAMPLE_002")).title).toBe("Squatter");
    await db.caseSession.updateMany({ where: { status: "ACTIVE" }, data: { status: "CLOSED" } });
    const rerun = await importCasebank(db, broken, { dryRun: false });
    expect(rerun.ok && rerun.outcomes.map((o) => o.status)).toEqual(["applied", "applied"]);
    expect((await caseByExternal("SAMPLE_002")).title).toBe("Bike Share Growth");
  });

  it("a dry run previews without writing", async () => {
    const before = await db.case.count();
    const r = await importCasebank(db, fixture(), { dryRun: true });
    expect(r.ok && r.cases.map((c) => [c.externalId, c.action, c.counts.facts, c.counts.hints])).toEqual([
      ["SAMPLE_001", "create", 3, 3],
      ["SAMPLE_002", "create", 1, 1],
    ]);
    expect(await db.case.count()).toBe(before);
  });

  describe("validation blocks the whole file before any write", () => {
    const expectRejected = async (mutate: (doc: ReturnType<typeof fixture>) => void, pattern: RegExp) => {
      const doc = fixture();
      mutate(doc);
      const before = await db.case.count();
      const r = await importCasebank(db, doc, { dryRun: false });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors.join("\n")).toMatch(pattern);
      expect(await db.case.count()).toBe(before);
    };

    it("a fact pointing at a missing node, named in the error", () =>
      expectRejected((d) => void (d.cases[0].extracted_case_facts[0].mapped_node_id = "N_NOPE"), /fact F_S1_01 points at node N_NOPE/));
    it("prototype-ish ids like constructor are just missing nodes", () =>
      expectRejected((d) => void (d.cases[0].extracted_case_facts[0].mapped_node_id = "constructor"), /points at node constructor/));
    it("a duplicate fact id", () => expectRejected((d) => void (d.cases[0].extracted_case_facts[1].fact_id = "F_S1_01"), /F_S1_01 appears twice/));
    it("a duplicate node id", () => expectRejected((d) => void (d.cases[0].issue_tree.nodes[1].node_id = "N_S1_ROOT"), /N_S1_ROOT appears twice/));
    it("a case type lowercase doesn't have", () => expectRejected((d) => void (d.cases[1].metadata.case_type = "Unconventional"), /case type "Unconventional"/));
    it("an unknown difficulty", () => expectRejected((d) => void (d.cases[0].metadata.difficulty = "Brutal"), /Easy, Moderate or Difficult/));
    it("an unsupported schema version", () => expectRejected((d) => void (d.schema_version = "3.0.0"), /2\.0\.0/));
  });
});
