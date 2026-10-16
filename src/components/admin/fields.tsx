"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export const inputCls = "w-full rounded-xl border border-line-strong bg-obsidian px-3 py-2.5 font-semibold text-ink outline-none focus:border-royal-bright";

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-muted">{label}</span>
      <span className="mt-1 block">{children}</span>
      {hint && <span className="mt-1 block text-xs text-faint">{hint}</span>}
    </label>
  );
}

export function move<T>(list: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= list.length) return list;
  const out = [...list];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

export type ListItem = {
  id: string | null;
  text: string;
  category?: string | null;
  nodeKey?: string | null;
  gatePrereqKeys?: string[];
  gateTrigger?: string | null;
  gateAntiLeak?: string | null;
  gateNudge?: string | null;
};

/** Ordered list of short text items (facts, hints, recommendations, observations). Ids and extra fields travel with their text. */
export function OrderedListEditor({
  label,
  items,
  onChange,
  placeholder,
  renderExtra,
}: {
  label: string;
  items: ListItem[];
  onChange: (v: ListItem[]) => void;
  placeholder?: string;
  renderExtra?: (item: ListItem, update: (p: Partial<ListItem>) => void) => React.ReactNode;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-bold text-muted">{label}</legend>
      <ol className="space-y-2">
        {items.map((t, i) => (
          <li key={t.id ?? `new-${i}`} className="flex flex-wrap items-start gap-2">
            <span className="mt-2.5 w-5 text-right text-sm font-bold tabular-nums text-faint">{i + 1}</span>
            <textarea
              aria-label={`${label} ${i + 1}`}
              rows={2}
              value={t.text}
              placeholder={placeholder}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
              className={cn(inputCls, "resize-y text-[14px]")}
            />
            <div className="flex flex-col">
              <button type="button" aria-label="Move up" className="rounded-lg p-1 text-faint hover:text-ink" onClick={() => onChange(move(items, i, -1))}>
                <ArrowUp size={14} />
              </button>
              <button type="button" aria-label="Move down" className="rounded-lg p-1 text-faint hover:text-ink" onClick={() => onChange(move(items, i, 1))}>
                <ArrowDown size={14} />
              </button>
              <button type="button" aria-label={`Remove ${label} ${i + 1}`} className="rounded-lg p-1 text-faint hover:text-amber" onClick={() => onChange(items.filter((_, j) => j !== i))}>
                <Trash2 size={14} />
              </button>
            </div>
            {renderExtra && <div className="basis-full pl-7">{renderExtra(t, (p) => onChange(items.map((x, j) => (j === i ? { ...x, ...p } : x))))}</div>}
          </li>
        ))}
      </ol>
      <Button size="sm" variant="ghost" className="mt-2" onClick={() => onChange([...items, { id: null, text: "" }])}>
        <Plus size={16} aria-hidden /> Add
      </Button>
    </fieldset>
  );
}
