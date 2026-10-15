import dagre from "@dagrejs/dagre";

export type TreeNodeData = { id: string; parentId: string | null; label: string; isCorrectPath: boolean; order: number };
export type PositionedNode = TreeNodeData & { x: number; y: number; width: number; height: number };
export type TreeEdge = { id: string; source: string; target: string; correct: boolean };

export const NODE_HEIGHT = 52;

export function nodeWidth(label: string) {
  return Math.max(120, Math.min(210, 28 + label.length * 8.2));
}

/** Top-to-bottom tree layout with dagre (KTD7). Returns top-left positions. */
export function layoutTree(nodes: TreeNodeData[]): { nodes: PositionedNode[]; edges: TreeEdge[] } {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: 28, ranksep: 64, marginx: 16, marginy: 16 });
  g.setDefaultEdgeLabel(() => ({}));
  const ids = new Set(nodes.map((n) => n.id));
  const ordered = [...nodes].sort((a, b) => a.order - b.order);
  for (const n of ordered) g.setNode(n.id, { width: nodeWidth(n.label), height: NODE_HEIGHT });
  const edges: TreeEdge[] = [];
  for (const n of ordered) {
    if (n.parentId && ids.has(n.parentId)) {
      g.setEdge(n.parentId, n.id);
      edges.push({ id: `${n.parentId}->${n.id}`, source: n.parentId, target: n.id, correct: n.isCorrectPath });
    }
  }
  dagre.layout(g);
  return {
    nodes: nodes.map((n) => {
      const p = g.node(n.id);
      const width = nodeWidth(n.label);
      return { ...n, width, height: NODE_HEIGHT, x: p.x - width / 2, y: p.y - NODE_HEIGHT / 2 };
    }),
    edges,
  };
}
