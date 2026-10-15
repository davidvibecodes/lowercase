"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, GitBranchPlus, LayoutGrid, Plus, Trash2 } from "lucide-react";
import { LazyIssueTree } from "@/components/issue-tree/LazyIssueTree";
import type { TreeNodeData } from "@/components/issue-tree/layout";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { toast } from "@/components/ui/Toast";
import { saveTreeAction } from "@/app/(app)/admin/cases/actions";
import { validateTree } from "@/lib/rules/tree";
import { inputCls } from "./fields";

let seq = 0;
const newId = () => `new_${Date.now().toString(36)}_${seq++}`;

function descendants(nodes: TreeNodeData[], id: string): Set<string> {
  const out = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const n of nodes) if (n.parentId && out.has(n.parentId) && !out.has(n.id)) (out.add(n.id), (grew = true));
  }
  return out;
}

/** Visual issue-tree builder on the React Flow canvas (R30). */
export function TreeBuilder({ caseId, initial }: { caseId: string; initial: TreeNodeData[] }) {
  const [nodes, setNodes] = useState(initial);
  const [selected, setSelected] = useState<string | null>(null);
  const [fitKey, setFitKey] = useState(0);
  const [pending, start] = useTransition();
  const labelRef = useRef<HTMLInputElement>(null);
  const sel = nodes.find((n) => n.id === selected) ?? null;
  const check = useMemo(() => validateTree(nodes.map((n) => ({ key: n.id, parentKey: n.parentId, label: n.label, isCorrectPath: n.isCorrectPath }))), [nodes]);

  const addRoot = () => {
    const id = newId();
    setNodes([{ id, parentId: null, label: "Root question", isCorrectPath: true, order: 0 }]);
    setSelected(id);
  };
  const addChild = () => {
    if (!sel) return;
    const id = newId();
    const order = nodes.filter((n) => n.parentId === sel.id).length;
    setNodes((l) => [...l, { id, parentId: sel.id, label: "New branch", isCorrectPath: false, order }]);
    setSelected(id);
    window.setTimeout(() => labelRef.current?.select(), 50);
  };
  const remove = () => {
    if (!sel) return;
    const gone = descendants(nodes, sel.id);
    setNodes((l) => l.filter((n) => !gone.has(n.id)));
    setSelected(null);
  };
  const patch = (p: Partial<TreeNodeData>) => sel && setNodes((l) => l.map((n) => (n.id === sel.id ? { ...n, ...p } : n)));

  const save = () =>
    start(async () => {
      const r = await saveTreeAction(
        caseId,
        nodes.map((n) => ({ key: n.id, parentKey: n.parentId, label: n.label, isCorrectPath: n.isCorrectPath })),
      );
      if (!r.ok) return toast(r.error, "warning");
      toast(r.warnings.length ? `Tree saved with ${r.warnings.length} warning(s)` : "Tree saved", r.warnings.length ? "warning" : "success");
    });

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4 sm:px-6">
        <div>
          <h2 className="text-lg font-extrabold">Interactive issue tree</h2>
          <p className="text-sm text-faint">Select a node to edit it. Double-click to rename. Blue = correct issue path, grey = standard branch.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => setFitKey((k) => k + 1)}>
            <LayoutGrid size={16} aria-hidden /> Auto layout
          </Button>
          <Button size="sm" disabled={pending || check.errors.length > 0} onClick={save}>
            Save tree
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-obsidian px-4 py-3 sm:px-6" role="toolbar" aria-label="Node tools">
        {nodes.length === 0 ? (
          <Button size="sm" onClick={addRoot}>
            <Plus size={16} aria-hidden /> Add root
          </Button>
        ) : sel ? (
          <>
            <label className="sr-only" htmlFor="node-label">
              Node label
            </label>
            <input id="node-label" ref={labelRef} className={`${inputCls} max-w-xs py-1.5`} value={sel.label} onChange={(e) => patch({ label: e.target.value })} />
            <Button size="sm" variant="secondary" onClick={addChild}>
              <GitBranchPlus size={16} aria-hidden /> Add child
            </Button>
            <Button size="sm" variant={sel.isCorrectPath ? "primary" : "secondary"} aria-pressed={sel.isCorrectPath} onClick={() => patch({ isCorrectPath: !sel.isCorrectPath })}>
              <CheckCircle2 size={16} aria-hidden /> {sel.isCorrectPath ? "Correct Issue Path" : "Standard Branch"}
            </Button>
            <Button size="sm" variant="ghost" onClick={remove}>
              <Trash2 size={16} className="text-amber" aria-hidden /> Delete subtree
            </Button>
          </>
        ) : (
          <span className="text-sm text-faint">Select a node on the canvas.</span>
        )}
        <span className="flex-1" />
        <span className="text-xs font-bold text-faint">{nodes.length} nodes</span>
      </div>

      {(check.errors.length > 0 || check.warnings.length > 0) && (
        <ul className="space-y-1 border-b border-line px-4 py-2 text-sm sm:px-6" aria-live="polite">
          {check.errors.map((e) => (
            <li key={e} className="font-bold text-amber">
              {e}
            </li>
          ))}
          {check.warnings.map((w) => (
            <li key={w} className="flex items-center gap-1.5 text-muted">
              <AlertTriangle size={14} className="text-amber" aria-hidden /> {w}
            </li>
          ))}
        </ul>
      )}

      <div className="h-[560px] bg-obsidian">
        {nodes.length ? (
          <LazyIssueTree nodes={nodes} selectedId={selected} onSelectNode={setSelected} onRenameNode={(id) => (setSelected(id), window.setTimeout(() => labelRef.current?.select(), 30))} fitKey={fitKey} />
        ) : (
          <div className="grid h-full place-items-center text-sm text-faint">Empty canvas. Add a root to start.</div>
        )}
      </div>
    </Card>
  );
}
