import type { TreeNodeInput } from "../../src/lib/types";

export type TreeSpec = { label: string; correct?: boolean; children?: TreeSpec[] };

/** Shorthand: n("Revenues", true, [...children]). */
export function n(label: string, correct = false, children: TreeSpec[] = []): TreeSpec {
  return { label, correct, children };
}

/** Flattens a nested tree spec into keyed rows (key = path index). */
export function flattenTree(root: TreeSpec): TreeNodeInput[] {
  const out: TreeNodeInput[] = [];
  const walk = (node: TreeSpec, key: string, parentKey: string | null) => {
    out.push({ key, parentKey, label: node.label, isCorrectPath: Boolean(node.correct) });
    (node.children ?? []).forEach((child, i) => walk(child, `${key}.${i}`, key));
  };
  walk(root, "0", null);
  return out;
}
