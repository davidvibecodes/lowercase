"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { TreeNodeData } from "@/components/issue-tree/layout";
import { FACT_CATEGORIES, type FactCategory } from "@/lib/types";
import { inputCls, type ListItem } from "./fields";

const CATEGORY_LABEL: Record<FactCategory, string> = {
  CLARIFYING_SCOPING: "Clarifying / scoping",
  TREE_DIRECTIONAL: "Tree: directional",
  TREE_ELIMINATION: "Tree: elimination",
  ROOT_CAUSE: "Root cause",
};

/**
 * Casebank fields under a fact or recommendation (R23, R25), collapsed until
 * opened. Node choices come from the tree, so a reference is always a real key.
 */
export function FactFields({ item, update, tree, kind }: { item: ListItem; update: (p: Partial<ListItem>) => void; tree: TreeNodeData[]; kind: "fact" | "recommendation" }) {
  const filled = Boolean(item.category || item.nodeKey || item.gateTrigger || item.gateAntiLeak || item.gateNudge || item.gatePrereqKeys?.length);
  const [open, setOpen] = useState(false);
  const Chevron = open ? ChevronDown : ChevronRight;
  const prereqs = new Set(item.gatePrereqKeys ?? []);
  const nodeLabel = (key: string | null | undefined) => tree.find((n) => n.id === key)?.label;

  return (
    <div className="rounded-xl border border-line bg-obsidian/60 px-3 py-2">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-1.5 text-left text-xs font-bold text-muted hover:text-ink">
        <Chevron size={14} aria-hidden />
        {kind === "fact" ? "Reveal guidance" : "Category and target node"}
        {!open && filled && <span className="truncate font-semibold text-faint">· {[item.category, nodeLabel(item.nodeKey)].filter(Boolean).join(" · ") || "set"}</span>}
      </button>
      {open && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className="text-xs font-bold text-muted">
            Category
            {kind === "fact" ? (
              <select className={`${inputCls} mt-1 py-1.5 text-sm`} value={item.category ?? ""} onChange={(e) => update({ category: e.target.value || null })}>
                <option value="">None</option>
                {FACT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
            ) : (
              <input className={`${inputCls} mt-1 py-1.5 text-sm`} value={item.category ?? ""} onChange={(e) => update({ category: e.target.value || null })} />
            )}
          </label>
          <label className="text-xs font-bold text-muted">
            {kind === "fact" ? "Tree node" : "Target node"}
            <select className={`${inputCls} mt-1 py-1.5 text-sm`} value={item.nodeKey ?? ""} onChange={(e) => update({ nodeKey: e.target.value || null })}>
              <option value="">None</option>
              {tree.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.label}
                </option>
              ))}
            </select>
          </label>
          {kind === "fact" && (
            <>
              <fieldset className="text-xs font-bold text-muted sm:col-span-2">
                <legend>Cover these nodes first</legend>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                  {tree.map((n) => (
                    <label key={n.id} className="flex items-center gap-1.5 font-semibold text-ink">
                      <input
                        type="checkbox"
                        className="size-3.5 accent-[var(--color-royal-bright)]"
                        checked={prereqs.has(n.id)}
                        onChange={(e) => update({ gatePrereqKeys: e.target.checked ? [...prereqs, n.id] : [...prereqs].filter((k) => k !== n.id) })}
                      />
                      {n.label}
                    </label>
                  ))}
                  {tree.length === 0 && <span className="font-semibold text-faint">Build the tree first.</span>}
                </div>
              </fieldset>
              <label className="text-xs font-bold text-muted sm:col-span-2">
                Reveal when
                <textarea rows={2} className={`${inputCls} mt-1 text-sm`} value={item.gateTrigger ?? ""} onChange={(e) => update({ gateTrigger: e.target.value || null })} />
              </label>
              <label className="text-xs font-bold text-muted">
                Don&apos;t leak
                <textarea rows={2} className={`${inputCls} mt-1 text-sm`} value={item.gateAntiLeak ?? ""} onChange={(e) => update({ gateAntiLeak: e.target.value || null })} />
              </label>
              <label className="text-xs font-bold text-muted">
                If skipped, nudge
                <textarea rows={2} className={`${inputCls} mt-1 text-sm`} value={item.gateNudge ?? ""} onChange={(e) => update({ gateNudge: e.target.value || null })} />
              </label>
            </>
          )}
        </div>
      )}
    </div>
  );
}
