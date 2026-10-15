import { beforeAll, describe, expect, it } from "vitest";
import { layoutTree, type TreeNodeData } from "@/components/issue-tree/layout";
import { db, resetAndSeed } from "./helpers/db";

let nodes: TreeNodeData[];

beforeAll(async () => {
  await resetAndSeed();
  const c = await db.case.findFirstOrThrow({ where: { title: "Diagnostic Center – Mumbai" }, include: { nodes: true } });
  nodes = c.nodes.map((n) => ({ id: n.id, parentId: n.parentId, label: n.label, isCorrectPath: n.isCorrectPath, order: n.order }));
});

describe("issue tree layout", () => {
  it("lays out the Mumbai tree as 19 nodes and 18 edges", () => {
    const out = layoutTree(nodes);
    expect(out.nodes).toHaveLength(19);
    expect(out.edges).toHaveLength(18);
  });

  it("places every child below its parent with no overlapping boxes", () => {
    const { nodes: laid } = layoutTree(nodes);
    const byId = new Map(laid.map((n) => [n.id, n]));
    for (const n of laid) if (n.parentId) expect(n.y).toBeGreaterThan(byId.get(n.parentId)!.y);
    for (let i = 0; i < laid.length; i++)
      for (let j = i + 1; j < laid.length; j++) {
        const a = laid[i];
        const b = laid[j];
        const overlap = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
        expect(overlap, `${a.label} overlaps ${b.label}`).toBe(false);
      }
  });

  it("colours an edge blue when its child is on the correct path", () => {
    const { edges } = layoutTree(nodes);
    const label = (id: string) => nodes.find((n) => n.id === id)!.label;
    const edge = (from: string, to: string) => edges.find((e) => label(e.source) === from && label(e.target) === to)!;
    expect(edge("Pathology", "Number of Patients").correct).toBe(true);
    expect(edge("Pathology", "Average Price/Test").correct).toBe(false);
  });
});
