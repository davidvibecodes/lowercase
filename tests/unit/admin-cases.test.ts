import { beforeEach, describe, expect, it } from "vitest";
import * as admin from "@/server/services/admin-cases";
import { db, resetAndSeed, userId } from "./helpers/db";

describe("admin cases", () => {
  beforeEach(async () => {
    await resetAndSeed();
  });

  it("saves a new case's tree and reopens it with the same nodes and blue edge", async () => {
    const c = await admin.createCase(db, { title: "Toy case", caseType: "Pricing", difficulty: 1, problemStatement: "Price it.", published: true });
    await admin.saveTree(db, c.id, [
      { key: "r", parentKey: null, label: "Profit", isCorrectPath: true },
      { key: "a", parentKey: "r", label: "Revenue", isCorrectPath: true },
      { key: "b", parentKey: "r", label: "Cost", isCorrectPath: false },
    ]);
    const nodes = (await admin.getCaseAdmin(db, c.id))!.nodes;
    expect(nodes.map((n) => n.label).sort()).toEqual(["Cost", "Profit", "Revenue"]);
    expect(nodes.find((n) => n.label === "Revenue")!.isCorrectPath).toBe(true);
  });

  it("refuses an invalid tree and keeps the old one", async () => {
    const c = await db.case.findFirstOrThrow({ where: { title: "Diagnostic Center – Mumbai" } });
    await expect(admin.saveTree(db, c.id, [{ key: "x", parentKey: null, label: "", isCorrectPath: false }])).rejects.toThrow("Every node needs a label");
    expect(await db.issueTreeNode.count({ where: { caseId: c.id } })).toBe(19);
  });

  it("re-saving the Mumbai tree unchanged keeps 19 nodes", async () => {
    const c = (await admin.getCaseAdmin(db, (await db.case.findFirstOrThrow({ where: { title: "Diagnostic Center – Mumbai" } })).id))!;
    await admin.saveTree(db, c.id, c.nodes.map((n) => ({ key: n.id, parentKey: n.parentId, label: n.label, isCorrectPath: n.isCorrectPath })));
    expect(await db.issueTreeNode.count({ where: { caseId: c.id } })).toBe(19);
  });

  it("edits a played case's facts without breaking reveal history, and archives removed facts", async () => {
    const c = (await admin.getCaseAdmin(db, (await db.case.findFirstOrThrow({ where: { title: "Diagnostic Center – Mumbai" } })).id))!;
    const facts = c.items.filter((i) => i.kind === "fact");
    const s = await db.caseSession.create({ data: { hostId: await userId("davidsathyandevice"), caseId: c.id, status: "ACTIVE" } });
    await db.sessionReveal.create({ data: { sessionId: s.id, round: 1, caseItemId: facts[0].id } });

    await admin.saveCaseItems(db, c.id, "fact", [{ id: facts[0].id, text: "Revenue fell; costs flat" }, ...facts.slice(2).map((f) => ({ id: f.id, text: f.text })), { id: null, text: "A new fact" }]);

    const live = await db.caseItem.findMany({ where: { caseId: c.id, kind: "fact", archivedAt: null }, orderBy: { order: "asc" } });
    expect(live[0].text).toBe("Revenue fell; costs flat");
    expect(live.map((f) => f.text)).toContain("A new fact");
    expect(live).toHaveLength(5);
    expect((await db.caseItem.findUniqueOrThrow({ where: { id: facts[1].id } })).archivedAt).not.toBeNull();
    expect(await db.sessionReveal.count({ where: { sessionId: s.id } })).toBe(1);
  });

  it("splits pasted text into alternating transcript turns", () => {
    const turns = admin.splitTranscript("One\n\nTwo\n\nThree\n\nFour");
    expect(turns.map((t) => t.speaker)).toEqual(["interviewer", "candidate", "interviewer", "candidate"]);
  });
});
