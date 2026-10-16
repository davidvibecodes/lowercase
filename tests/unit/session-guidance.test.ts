import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { importCasebank } from "@/server/services/casebank";
import { buildView } from "@/server/services/sessions";
import { db, resetAndSeed, userId } from "./helpers/db";

const fixture = () => JSON.parse(readFileSync(resolve(import.meta.dirname, "../fixtures/casebank-sample.json"), "utf8"));

let interviewer: string, interviewee: string, sessionId: string, caseId: string;

beforeEach(async () => {
  await resetAndSeed();
  [interviewer, interviewee] = [await userId("davidsathyandevice"), await userId("roy")];
  await importCasebank(db, fixture(), { dryRun: false });
  caseId = (await db.case.findUniqueOrThrow({ where: { externalId: "SAMPLE_001" } })).id;
  sessionId = (
    await db.caseSession.create({
      data: { hostId: interviewer, guestId: interviewee, interviewerId: interviewer, intervieweeId: interviewee, caseId, status: "ACTIVE", caseType: "Profitability", difficulty: 2 },
    })
  ).id;
});

const view = (who: string) => buildView(db, sessionId, who, new Set([interviewer, interviewee]));

describe("reveal guidance in the cockpit (R26, U11)", () => {
  it("covers AE6: the interviewer sees each fact's guidance with node labels", async () => {
    const v = await view(interviewer);
    const fact = v.interviewer!.facts.find((f) => f.text.startsWith("Ingredient costs"))!;
    expect(fact.guidance).toEqual({
      category: "TREE_DIRECTIONAL",
      node: "Cost",
      coverFirst: ["Profit"],
      trigger: "Candidate splits costs into fixed and variable.",
      antiLeak: "Don't name the supplier contract.",
      nudge: "Have you looked at what goes into each loaf?",
    });
    expect(v.interviewer!.given.map((g) => g.text)).toEqual(["Profits fell by half over twelve months", "Flour prices rose sharply"]);
    expect(v.interviewer!.recommendations[0]).toMatchObject({ category: "Procurement", target: "Flour contract" });
    expect(v.interviewer!.tree.find((n) => n.label === "Flour contract")).toMatchObject({ status: "ROOT_CAUSE" });
    expect(v.interviewer!.tree.find((n) => n.label === "Profit")?.formula).toBe("Profit = Revenue - Cost");
  });

  it("covers AE6: the interviewee's payload contains none of the interviewer-only fields", async () => {
    const fact = await db.caseItem.findFirstOrThrow({ where: { caseId, externalId: "F_S1_02" } });
    await db.sessionReveal.create({ data: { sessionId, round: 1, caseItemId: fact.id } });
    const v = await view(interviewee);
    expect(v.interviewer).toBeNull();
    expect(v.interviewee!.revealedFacts.map((f) => f.text)).toEqual(["Ingredient costs are up 40%, mostly flour."]);
    const raw = JSON.stringify(v);
    for (const leak of [
      "guidance",
      "TREE_DIRECTIONAL",
      "Candidate splits costs",
      "supplier contract",
      "Procurement",
      "Flour contract",
      "Profits fell by half",
      "Flour prices rose sharply",
      "coverFirst",
      "formula",
    ]) {
      expect(raw, leak).not.toContain(leak);
    }
  });

  it("shows a dangling prerequisite as a removed node instead of failing", async () => {
    await db.caseItem.updateMany({ where: { caseId, externalId: "F_S1_02" }, data: { gatePrereqKeys: '["N_GONE"]' } });
    const fact = (await view(interviewer)).interviewer!.facts.find((f) => f.text.startsWith("Ingredient costs"))!;
    expect(fact.guidance?.coverFirst).toEqual(["(removed node)"]);
  });

  it("leaves facts of an older case without guidance", async () => {
    const mumbai = await db.case.findFirstOrThrow({ where: { title: "Diagnostic Center – Mumbai" } });
    await db.caseSession.update({ where: { id: sessionId }, data: { caseId: mumbai.id } });
    const v = await view(interviewer);
    expect(v.interviewer!.facts.length).toBeGreaterThan(0);
    expect(v.interviewer!.facts.every((f) => f.guidance === null)).toBe(true);
    expect(v.interviewer!.given).toEqual([]);
  });

  it("counts only uses of hints that are still active", async () => {
    const hints = await db.caseItem.findMany({ where: { caseId, kind: "hint" }, orderBy: { order: "asc" } });
    expect(hints).toHaveLength(3);
    await db.sessionHintUse.create({ data: { sessionId, round: 1, caseItemId: hints[0].id } });
    await db.caseItem.update({ where: { id: hints[0].id }, data: { archivedAt: new Date() } });
    const v = await view(interviewee);
    expect(v.hintsTotal).toBe(2);
    expect(v.hintsUsedCount).toBe(0);
    expect(v.interviewee!.hintsRemaining).toBe(2);
  });
});
