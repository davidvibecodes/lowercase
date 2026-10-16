import { describe, expect, it } from "vitest";
import { validateTree } from "@/lib/rules/tree";

const n = (key: string, parentKey: string | null, label = key, isCorrectPath = false) => ({ key, parentKey, label, isCorrectPath });

describe("validateTree", () => {
  it("accepts a simple tree", () => {
    expect(validateTree([n("a", null, "Profit", true), n("b", "a", "Revenue", true), n("c", "a", "Cost")])).toEqual({ errors: [], warnings: [] });
  });
  it("rejects two roots", () => {
    expect(validateTree([n("a", null), n("b", null)]).errors).toContain("The tree can only have one root");
  });
  it("rejects a cycle", () => {
    expect(validateTree([n("r", null), n("a", "b"), n("b", "a")]).errors).toContain("The tree contains a cycle");
  });
  it("rejects an empty label", () => {
    expect(validateTree([n("a", null, "  ")]).errors).toContain("Every node needs a label");
  });
  it("warns, without blocking, when a blue node hangs off a grey parent", () => {
    const r = validateTree([n("a", null, "Profit"), n("b", "a", "Revenue", true)]);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual(['Correct path is broken at "Revenue"']);
  });
  it("rejects duplicate or empty keys instead of collapsing them", () => {
    expect(validateTree([n("a", null, "Profit"), n("a", "a", "Revenue")]).errors).toContain("Two nodes share the key \"a\"");
    expect(validateTree([n("", null, "Profit")]).errors).toContain("Every node needs a key");
  });
  it("rejects a tree that drops a node something still points at", () => {
    const r = validateTree([n("a", null, "Profit"), n("b", "a", "Revenue")], [{ label: "Fact about cost", keys: ["c"] }, { label: "Fact about revenue", keys: ["b"] }]);
    expect(r.errors).toEqual(['"Fact about cost" points at a node this tree no longer has. Re-point it first.']);
  });
});
