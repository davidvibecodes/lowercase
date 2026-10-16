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

  describe("stable tree keys and casebank fields (U9)", () => {
    const tree = [
      { key: "root", parentKey: null, label: "Profit", isCorrectPath: true, status: "ACTIVE_BRANCH" as const, formula: "Profit = Revenue - Cost" },
      { key: "rev", parentKey: "root", label: "Revenue", isCorrectPath: true, status: "ACTIVE_BRANCH" as const, formula: null },
      { key: "cost", parentKey: "root", label: "Cost", isCorrectPath: false, status: "ELIMINATED_BRANCH" as const, formula: null },
      { key: "lock", parentKey: "rev", label: "Lock-in period", isCorrectPath: true, status: "ROOT_CAUSE" as const, formula: null },
    ];
    const newCase = () => admin.createCase(db, { title: "Keys case", caseType: "Profitability", difficulty: 1, problemStatement: "Why?", published: true });

    it("keeps every node's key across saves while row ids change, and facts still resolve", async () => {
      const c = await newCase();
      await admin.saveTree(db, c.id, tree);
      const firstIds = (await db.issueTreeNode.findMany({ where: { caseId: c.id } })).map((n) => n.id).sort();
      await admin.saveCaseItems(db, c.id, "fact", [{ id: null, text: "Lock-in is 12 months at CP", category: "ROOT_CAUSE", nodeKey: "lock", gatePrereqKeys: ["rev"], gateTrigger: "Asks about rent terms", gateAntiLeak: "Don't mention 6 months yet", gateNudge: "What about the outlet contracts?" }]);
      await admin.saveTree(db, c.id, tree);
      const nodes = await db.issueTreeNode.findMany({ where: { caseId: c.id } });
      expect(nodes.map((n) => n.id).sort()).not.toEqual(firstIds);
      expect(nodes.map((n) => n.key).sort()).toEqual(["cost", "lock", "rev", "root"]);
      const fact = await db.caseItem.findFirstOrThrow({ where: { caseId: c.id, kind: "fact" } });
      expect(nodes.some((n) => n.key === fact.nodeKey)).toBe(true);
    });

    it("round-trips node status, formula and every fact gate field", async () => {
      const c = await newCase();
      await admin.saveTree(db, c.id, tree);
      const saved = await admin.saveCaseItems(db, c.id, "fact", [
        { id: null, text: "Fact", category: "TREE_DIRECTIONAL", nodeKey: "rev", gatePrereqKeys: ["root"], gateTrigger: "t", gateAntiLeak: "a", gateNudge: "n" },
      ]);
      expect(saved[0]).toMatchObject({ text: "Fact", category: "TREE_DIRECTIONAL", nodeKey: "rev", gatePrereqKeys: ["root"], gateTrigger: "t", gateAntiLeak: "a", gateNudge: "n" });
      const lock = await db.issueTreeNode.findFirstOrThrow({ where: { caseId: c.id, key: "lock" } });
      expect(lock).toMatchObject({ status: "ROOT_CAUSE", isCorrectPath: true });
      expect((await db.issueTreeNode.findFirstOrThrow({ where: { caseId: c.id, key: "root" } })).formula).toBe("Profit = Revenue - Cost");
    });

    it("refuses a tree save that would drop a node a fact or recommendation points at (R25)", async () => {
      const c = await newCase();
      await admin.saveTree(db, c.id, tree);
      await admin.saveCaseItems(db, c.id, "fact", [{ id: null, text: "About lock-in", nodeKey: "lock" }]);
      await expect(admin.saveTree(db, c.id, tree.filter((n) => n.key !== "lock"))).rejects.toThrow(/About lock-in/);
      // Re-point the fact first, then the deletion saves.
      const fact = await db.caseItem.findFirstOrThrow({ where: { caseId: c.id, kind: "fact" } });
      await admin.saveCaseItems(db, c.id, "fact", [{ id: fact.id, text: fact.text, nodeKey: "rev" }]);
      await admin.saveTree(db, c.id, tree.filter((n) => n.key !== "lock"));
      expect(await db.issueTreeNode.count({ where: { caseId: c.id } })).toBe(3);
    });

    it("refuses a fact that points at a node the tree doesn't have", async () => {
      const c = await newCase();
      await admin.saveTree(db, c.id, tree);
      await expect(admin.saveCaseItems(db, c.id, "fact", [{ id: null, text: "x", nodeKey: "nope" }])).rejects.toThrow(/isn't in the tree/);
    });

    it("archives a removed fact and keeps its reveal record", async () => {
      const c = await db.case.findFirstOrThrow({ where: { title: "Diagnostic Center – Mumbai" }, include: { items: { where: { kind: "fact", archivedAt: null }, orderBy: { order: "asc" } } } });
      const [first, ...rest] = c.items;
      const s = await db.caseSession.create({ data: { hostId: await userId("roy"), caseId: c.id, status: "ACTIVE" } });
      await db.sessionReveal.create({ data: { sessionId: s.id, round: 1, caseItemId: first.id } });
      await admin.saveCaseItems(db, c.id, "fact", rest.map((f) => ({ id: f.id, text: f.text })));
      expect((await db.caseItem.findUniqueOrThrow({ where: { id: first.id } })).archivedAt).not.toBeNull();
      expect(await db.sessionReveal.count({ where: { caseItemId: first.id } })).toBe(1);
    });

    it("keeps an old case without gate fields unchanged when saved (R27)", async () => {
      const c = await db.case.findFirstOrThrow({ where: { title: "Diagnostic Center – Mumbai" }, include: { nodes: true } });
      const before = c.nodes.map((n) => [n.key, n.label, n.isCorrectPath]).sort();
      const keyOf = new Map(c.nodes.map((n) => [n.id, n.key]));
      await admin.saveTree(db, c.id, c.nodes.map((n) => ({ key: n.key, parentKey: n.parentId ? keyOf.get(n.parentId)! : null, label: n.label, isCorrectPath: n.isCorrectPath })));
      const after = (await db.issueTreeNode.findMany({ where: { caseId: c.id } })).map((n) => [n.key, n.label, n.isCorrectPath]).sort();
      expect(after).toEqual(before);
    });
  });

  it("splits pasted text into alternating transcript turns", () => {
    const turns = admin.splitTranscript("One\n\nTwo\n\nThree\n\nFour");
    expect(turns.map((t) => t.speaker)).toEqual(["interviewer", "candidate", "interviewer", "candidate"]);
  });
});
