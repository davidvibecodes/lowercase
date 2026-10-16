"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, ClipboardPaste, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Segmented } from "@/components/ui/Tabs";
import { toast } from "@/components/ui/Toast";
import { deleteCaseAction, saveCaseItemsAction, saveTranscriptAction, updateCaseMetaAction } from "@/app/(app)/admin/cases/actions";
import type { TreeNodeData } from "@/components/issue-tree/layout";
import { cn } from "@/lib/cn";
import { splitTranscript, type Turn } from "@/lib/transcript";
import { CASE_TYPES, DIFFICULTIES, DIFFICULTY_LABEL } from "@/lib/types";
import { FactFields } from "./FactFields";
import { Field, inputCls, move, OrderedListEditor, type ListItem } from "./fields";
import { TreeBuilder } from "./TreeBuilder";

type Meta = {
  id: string;
  title: string;
  caseType: string;
  difficulty: number;
  problemStatement: string;
  published: boolean;
  externalId?: string | null;
  industry?: string | null;
};
type Lists = Record<"fact" | "hint" | "recommendation" | "observation" | "given", ListItem[]>;

const LIST_LABELS: Record<keyof Lists, string> = {
  fact: "Case facts (each gets Reveal to Candidate)",
  hint: "Hints / directional nudges (I'm Stuck, in order)",
  recommendation: "Recommendations",
  observation: "Observations / takeaways",
  given: "Casebook summary (interviewer only)",
};

export function CaseEditor({ meta, lists, transcript, tree }: { meta: Meta; lists: Lists; transcript: Turn[]; tree: TreeNodeData[] }) {
  return (
    <div className="space-y-6">
      <Link href="/admin/cases" className="inline-flex items-center gap-1.5 text-sm font-bold text-muted hover:text-ink">
        <ArrowLeft size={16} aria-hidden /> All cases
      </Link>
      <MetaCard meta={meta} />
      <ListsCard caseId={meta.id} initial={lists} tree={tree} />
      <TreeBuilder caseId={meta.id} initial={tree} />
      <TranscriptCard caseId={meta.id} initial={transcript} />
    </div>
  );
}

function MetaCard({ meta }: { meta: Meta }) {
  const [m, setM] = useState(meta);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Card className="p-6">
      <h2 className="mb-1 text-lg font-extrabold">Case details</h2>
      {meta.externalId ? (
        <p className="mb-4 text-sm text-faint">
          Imported from the casebank as {meta.externalId}
          {meta.industry ? ` · ${meta.industry}` : ""}. Re-importing the file overwrites edits to imported fields.
        </p>
      ) : (
        <div className="mb-3" />
      )}
      <div className="grid gap-4">
        <Field label="Title">
          <input className={inputCls} value={m.title} onChange={(e) => setM({ ...m, title: e.target.value })} />
        </Field>
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="mb-1 text-sm font-bold text-muted">Case type</p>
            <Segmented label="Case type" size="sm" value={m.caseType} onChange={(v) => setM({ ...m, caseType: v })} options={CASE_TYPES.map((t) => ({ value: t, label: t }))} />
          </div>
          <div>
            <p className="mb-1 text-sm font-bold text-muted">Difficulty</p>
            <Segmented
              label="Difficulty"
              size="sm"
              value={String(m.difficulty)}
              onChange={(v) => setM({ ...m, difficulty: Number(v) })}
              options={DIFFICULTIES.map((d) => ({ value: String(d), label: DIFFICULTY_LABEL[d] }))}
            />
          </div>
        </div>
        <Field label="Problem statement">
          <textarea rows={3} className={inputCls} value={m.problemStatement} onChange={(e) => setM({ ...m, problemStatement: e.target.value })} />
        </Field>
        <label className="flex items-center gap-3 font-bold">
          <input type="checkbox" className="size-4 accent-[var(--color-emerald)]" checked={m.published} onChange={(e) => setM({ ...m, published: e.target.checked })} />
          Published (available in session case pickers)
        </label>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await updateCaseMetaAction(m.id, { title: m.title, caseType: m.caseType, difficulty: m.difficulty, problemStatement: m.problemStatement, published: m.published });
              toast(r.ok ? "Case saved" : r.error, r.ok ? "success" : "warning");
              if (r.ok) router.refresh();
            })
          }
        >
          Save details
        </Button>
        <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
          <Trash2 size={16} className="text-amber" aria-hidden /> Delete case
        </Button>
      </div>
      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete this case?">
        <p className="text-muted">Past results stay in analytics, but the case and its tree are removed.</p>
        <div className="mt-6 flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => setConfirmDelete(false)} data-autofocus>
            Cancel
          </Button>
          <Button
            variant="warning"
            className="flex-1"
            onClick={() =>
              start(async () => {
                const r = await deleteCaseAction(m.id);
                setConfirmDelete(false);
                if (r.ok) router.push("/admin/cases");
                else toast(r.error, "warning");
              })
            }
          >
            Delete
          </Button>
        </div>
      </Modal>
    </Card>
  );
}

function ListsCard({ caseId, initial, tree }: { caseId: string; initial: Lists; tree: TreeNodeData[] }) {
  const [lists, setLists] = useState(initial);
  const [pending, start] = useTransition();
  const router = useRouter();
  const save = () =>
    start(async () => {
      for (const kind of Object.keys(lists) as Array<keyof Lists>) {
        const r = await saveCaseItemsAction(caseId, kind, lists[kind]);
        if (!r.ok) return toast(`${LIST_LABELS[kind]}: ${r.error}`, "warning");
        setLists((l) => ({ ...l, [kind]: r.items }));
      }
      toast("Lists saved", "success");
      router.refresh();
    });
  return (
    <Card className="p-6">
      <h2 className="mb-4 text-lg font-extrabold">Facts, hints, recommendations &amp; observations</h2>
      <div className="grid gap-6 lg:grid-cols-2">
        {(Object.keys(LIST_LABELS) as Array<keyof Lists>).map((k) => (
          <OrderedListEditor
            key={k}
            label={LIST_LABELS[k]}
            items={lists[k]}
            onChange={(v) => setLists((l) => ({ ...l, [k]: v }))}
            renderExtra={k === "fact" || k === "recommendation" ? (item, update) => <FactFields item={item} update={update} tree={tree} kind={k} /> : undefined}
          />
        ))}
      </div>
      <p className="mt-3 text-xs text-faint">Node choices come from the saved tree. Save the tree first when you add nodes.</p>
      <Button className="mt-5" disabled={pending} onClick={save}>
        Save lists
      </Button>
    </Card>
  );
}

function TranscriptCard({ caseId, initial }: { caseId: string; initial: Turn[] }) {
  const [turns, setTurns] = useState(initial);
  const [paste, setPaste] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Card className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold">Full interview transcript ({turns.length} turns)</h2>
        <Button size="sm" variant="secondary" onClick={() => setPaste("")}>
          <ClipboardPaste size={16} aria-hidden /> Paste bulk
        </Button>
      </div>
      <ol className="space-y-2">
        {turns.map((t, i) => (
          <li key={i} className="flex items-start gap-2">
            <button
              type="button"
              onClick={() => setTurns((l) => l.map((x, j) => (j === i ? { ...x, speaker: x.speaker === "interviewer" ? "candidate" : "interviewer" } : x)))}
              className={cn("mt-1 w-28 shrink-0 rounded-lg px-2 py-1.5 text-xs font-extrabold uppercase", t.speaker === "interviewer" ? "bg-surface-3 text-muted" : "bg-royal-soft text-royal-bright")}
              aria-label={`Turn ${i + 1} speaker: ${t.speaker}. Click to switch.`}
            >
              {t.speaker}
            </button>
            <textarea aria-label={`Turn ${i + 1}`} rows={2} className={cn(inputCls, "text-[14px]")} value={t.text} onChange={(e) => setTurns((l) => l.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
            <div className="flex flex-col">
              <button type="button" aria-label="Move up" className="rounded-lg p-1 text-faint hover:text-ink" onClick={() => setTurns((l) => move(l, i, -1))}>
                <ArrowUp size={14} />
              </button>
              <button type="button" aria-label="Move down" className="rounded-lg p-1 text-faint hover:text-ink" onClick={() => setTurns((l) => move(l, i, 1))}>
                <ArrowDown size={14} />
              </button>
              <button type="button" aria-label={`Remove turn ${i + 1}`} className="rounded-lg p-1 text-faint hover:text-amber" onClick={() => setTurns((l) => l.filter((_, j) => j !== i))}>
                <Trash2 size={14} />
              </button>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex gap-3">
        <Button variant="ghost" onClick={() => setTurns((l) => [...l, { speaker: l.at(-1)?.speaker === "interviewer" ? "candidate" : "interviewer", text: "" }])}>
          <Plus size={16} aria-hidden /> Add turn
        </Button>
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await saveTranscriptAction(caseId, turns);
              toast(r.ok ? "Transcript saved" : r.error, r.ok ? "success" : "warning");
            })
          }
        >
          Save transcript
        </Button>
      </div>
      <Modal open={paste !== null} onClose={() => setPaste(null)} title="Paste a transcript" className="max-w-2xl">
        <p className="mb-2 text-sm text-muted">Separate turns with a blank line. Turns alternate, starting with the interviewer.</p>
        <textarea rows={12} className={inputCls} value={paste ?? ""} onChange={(e) => setPaste(e.target.value)} data-autofocus />
        <div className="mt-4 flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => setPaste(null)}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              setTurns((l) => [...l, ...splitTranscript(paste ?? "")]);
              setPaste(null);
            }}
          >
            Add turns
          </Button>
        </div>
      </Modal>
    </Card>
  );
}
