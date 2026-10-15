import type { TreeNodeInput } from "@/lib/types";

export type TreeCheck = { errors: string[]; warnings: string[] };

/** Validates an issue tree before save (U15). Errors block; warnings don't. */
export function validateTree(nodes: TreeNodeInput[]): TreeCheck {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (nodes.length === 0) return { errors, warnings };
  const byKey = new Map(nodes.map((n) => [n.key, n]));
  const roots = nodes.filter((n) => n.parentKey === null);
  if (roots.length !== 1) errors.push(roots.length === 0 ? "The tree needs a root" : "The tree can only have one root");
  for (const n of nodes) {
    if (!n.label.trim()) errors.push("Every node needs a label");
    if (n.parentKey !== null && !byKey.has(n.parentKey)) errors.push(`"${n.label}" points to a missing parent`);
  }
  // Cycle check: walking up from any node must reach a root within N steps.
  for (const n of nodes) {
    let cur: TreeNodeInput | undefined = n;
    let steps = 0;
    while (cur && cur.parentKey !== null && steps <= nodes.length) {
      cur = byKey.get(cur.parentKey);
      steps++;
    }
    if (steps > nodes.length) {
      errors.push("The tree contains a cycle");
      break;
    }
  }
  for (const n of nodes) {
    const parent = n.parentKey ? byKey.get(n.parentKey) : null;
    if (n.isCorrectPath && parent && !parent.isCorrectPath) warnings.push(`Correct path is broken at "${n.label}"`);
  }
  return { errors: [...new Set(errors)], warnings };
}
