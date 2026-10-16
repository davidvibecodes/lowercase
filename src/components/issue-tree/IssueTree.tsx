"use client";

import "@xyflow/react/dist/style.css";
import { Background, Controls, Handle, Position, ReactFlow, ReactFlowProvider, useReactFlow, type Edge, type Node, type NodeProps } from "@xyflow/react";
import { CheckCircle2, Target } from "lucide-react";
import { memo, useEffect, useMemo } from "react";
import { cn } from "@/lib/cn";
import { layoutTree, type TreeNodeData } from "./layout";

type IssueNodeData = { label: string; correct: boolean; selected: boolean; status: TreeNodeData["status"]; formula: string | null; height: number };

const STATUS_NOTE = { ROOT_CAUSE: "root cause", ELIMINATED_BRANCH: "eliminated branch", ACTIVE_BRANCH: null } as const;

const IssueNode = memo(function IssueNode({ data }: NodeProps<Node<IssueNodeData>>) {
  const rootCause = data.status === "ROOT_CAUSE";
  const notes = [data.correct ? "correct issue path" : null, data.status ? STATUS_NOTE[data.status] : null].filter(Boolean);
  const title = `${data.label}${notes.length ? ` (${notes.join(", ")})` : ""}${data.formula ? `
${data.formula}` : ""}`;
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border px-3 text-center text-[13px] font-bold leading-tight",
        // Root cause uses border and tint; the amber ring stays reserved for the selected node.
        rootCause
          ? "border-2 border-amber bg-amber-soft text-ink"
          : data.correct
            ? "border-royal-bright bg-royal text-white shadow-[0_6px_18px_-8px_#1d4ed8]"
            : "border-line-strong bg-grey-node text-muted",
        data.selected && "ring-2 ring-amber ring-offset-2 ring-offset-obsidian",
      )}
      style={{ height: data.height, width: "100%" }}
      title={title}
    >
      <Handle type="target" position={Position.Top} className="!size-1.5 !border-0 !bg-transparent" isConnectable={false} />
      <span className="flex items-center gap-1.5">
        {rootCause ? (
          <Target size={14} className="shrink-0 text-amber" aria-label="Root cause" />
        ) : (
          data.correct && <CheckCircle2 size={14} className="shrink-0" aria-label="On the correct path" />
        )}
        <span className="line-clamp-2">
          {data.label}
          {rootCause && <span className="sr-only"> (root cause)</span>}
        </span>
      </span>
      {data.formula && <span className="mt-0.5 block max-w-full truncate text-[11px] font-semibold opacity-80">{data.formula}</span>}
      <Handle type="source" position={Position.Bottom} className="!size-1.5 !border-0 !bg-transparent" isConnectable={false} />
    </div>
  );
});

const nodeTypes = { issue: IssueNode };

export type IssueTreeProps = {
  nodes: TreeNodeData[];
  selectedId?: string | null;
  onSelectNode?: (id: string | null) => void;
  onRenameNode?: (id: string) => void;
  className?: string;
  /** Changes to this value re-fit the view (e.g. after auto layout). */
  fitKey?: string | number;
};

function Flow({ nodes, selectedId, onSelectNode, onRenameNode, fitKey }: IssueTreeProps) {
  const { fitView } = useReactFlow();
  const { rfNodes, rfEdges } = useMemo(() => {
    const laid = layoutTree(nodes);
    const rfNodes: Node<IssueNodeData>[] = laid.nodes.map((n) => ({
      id: n.id,
      type: "issue",
      position: { x: n.x, y: n.y },
      data: { label: n.label || "Untitled", correct: n.isCorrectPath, selected: n.id === selectedId, status: n.status, formula: n.formula ?? null, height: n.height },
      style: { width: n.width },
      draggable: false,
      connectable: false,
    }));
    const rfEdges: Edge[] = laid.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: "smoothstep",
      style: { stroke: e.correct ? "var(--color-royal-bright)" : "var(--color-line-strong)", strokeWidth: e.correct ? 2.5 : 1.5 },
    }));
    return { rfNodes, rfEdges };
  }, [nodes, selectedId]);

  useEffect(() => {
    const t = window.setTimeout(() => fitView({ padding: 0.12, duration: 250 }), 30);
    return () => window.clearTimeout(t);
  }, [fitKey, nodes.length, fitView]);

  return (
    <ReactFlow
      nodes={rfNodes}
      edges={rfEdges}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.12 }}
      minZoom={0.2}
      maxZoom={1.75}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={Boolean(onSelectNode)}
      onNodeClick={onSelectNode ? (_, n) => onSelectNode(n.id) : undefined}
      onNodeDoubleClick={onRenameNode ? (_, n) => onRenameNode(n.id) : undefined}
      onPaneClick={onSelectNode ? () => onSelectNode(null) : undefined}
      proOptions={{ hideAttribution: true }}
      colorMode="dark"
    >
      <Background color="#262936" gap={22} />
      <Controls showInteractive={false} position="bottom-right" />
    </ReactFlow>
  );
}

/** Issue tree viewer/builder canvas: correct path in blue, other MECE branches in grey (R18, R30). */
export default function IssueTree(props: IssueTreeProps) {
  return (
    <div className={cn("h-full w-full", props.className)} data-testid="issue-tree">
      <ReactFlowProvider>
        <Flow {...props} />
      </ReactFlowProvider>
    </div>
  );
}
