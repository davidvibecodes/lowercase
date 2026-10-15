"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Plus, Trash2 } from "lucide-react";
import { CONCEPT_ICON_NAMES, ConceptIcon } from "@/components/home/ConceptIcon";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Markdown } from "@/components/ui/Markdown";
import { toast } from "@/components/ui/Toast";
import { deleteQuestionAction, saveExplainersAction, saveQuestionAction, updateConceptAction } from "@/app/(app)/admin/concepts/actions";
import { cn } from "@/lib/cn";
import { Field, inputCls, move } from "./fields";

type Concept = { id: string; slug: string; title: string; summary: string; icon: string; published: boolean };
type Explainer = { title: string; body: string };
export type QuestionDraft = { id: string | null; kind: "concept" | "application"; prompt: string; scenario: string; explanation: string; options: Array<{ text: string; isCorrect: boolean }> };

export function ConceptEditor({ concept, explainers, questions }: { concept: Concept; explainers: Explainer[]; questions: QuestionDraft[] }) {
  return (
    <div className="space-y-6">
      <Link href="/admin/concepts" className="inline-flex items-center gap-1.5 text-sm font-bold text-muted hover:text-ink">
        <ArrowLeft size={16} aria-hidden /> All concepts
      </Link>
      <DetailsCard concept={concept} />
      <ExplainersCard conceptId={concept.id} initial={explainers} />
      <QuestionsCard conceptId={concept.id} initial={questions} />
    </div>
  );
}

function DetailsCard({ concept }: { concept: Concept }) {
  const [form, setForm] = useState(concept);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Card className="p-6">
      <h2 className="mb-4 text-lg font-extrabold">Concept</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title">
          <input className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </Field>
        <Field label="URL slug" hint={`/learn/${form.slug}`}>
          <input className={inputCls} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Summary">
            <input className={inputCls} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
          </Field>
        </div>
        <fieldset>
          <legend className="text-sm font-bold text-muted">Icon</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {CONCEPT_ICON_NAMES.map((name) => (
              <button
                key={name}
                type="button"
                aria-label={name}
                aria-pressed={form.icon === name}
                onClick={() => setForm({ ...form, icon: name })}
                className={cn("grid size-10 place-items-center rounded-xl border", form.icon === name ? "border-royal-bright bg-royal-soft text-royal-bright" : "border-line text-muted")}
              >
                <ConceptIcon name={name} size={18} />
              </button>
            ))}
          </div>
        </fieldset>
        <label className="flex items-center gap-3 self-end pb-2 font-bold">
          <input type="checkbox" className="size-4 accent-[var(--color-emerald)]" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} />
          Published (visible to learners)
        </label>
      </div>
      <Button
        className="mt-5"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await updateConceptAction(concept.id, { slug: form.slug, title: form.title, summary: form.summary, icon: form.icon, published: form.published });
            toast(r.ok ? "Concept saved" : r.error, r.ok ? "success" : "warning");
            if (r.ok) router.refresh();
          })
        }
      >
        Save concept
      </Button>
    </Card>
  );
}

function ExplainersCard({ conceptId, initial }: { conceptId: string; initial: Explainer[] }) {
  const [list, setList] = useState(initial);
  const [pending, start] = useTransition();
  const update = (i: number, patch: Partial<Explainer>) => setList((l) => l.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-extrabold">Explainer cards</h2>
        <span className="text-sm text-faint">Markdown: **bold**, lists, tables, `code`</span>
      </div>
      <ol className="space-y-4">
        {list.map((e, i) => (
          <li key={i} className="rounded-2xl border border-line bg-obsidian p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="font-extrabold text-faint">Card {i + 1}</span>
              <span className="flex-1" />
              <Button size="sm" variant="ghost" aria-label="Move card up" onClick={() => setList((l) => move(l, i, -1))}>
                <ArrowUp size={14} />
              </Button>
              <Button size="sm" variant="ghost" aria-label="Move card down" onClick={() => setList((l) => move(l, i, 1))}>
                <ArrowDown size={14} />
              </Button>
              <Button size="sm" variant="ghost" aria-label="Remove card" onClick={() => setList((l) => l.filter((_, j) => j !== i))}>
                <Trash2 size={14} className="text-amber" />
              </Button>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <Field label="Title">
                  <input className={inputCls} value={e.title} onChange={(ev) => update(i, { title: ev.target.value })} />
                </Field>
                <Field label="Body">
                  <textarea rows={8} className={cn(inputCls, "font-mono text-[13px]")} value={e.body} onChange={(ev) => update(i, { body: ev.target.value })} />
                </Field>
              </div>
              <div className="rounded-2xl border border-line bg-surface p-4" aria-label="Preview">
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-faint">Preview</p>
                <h3 className="text-xl font-extrabold">{e.title || "Untitled"}</h3>
                <Markdown source={e.body} />
              </div>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex gap-3">
        <Button variant="secondary" onClick={() => setList((l) => [...l, { title: "", body: "" }])}>
          <Plus size={16} aria-hidden /> Add card
        </Button>
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await saveExplainersAction(conceptId, list);
              toast(r.ok ? "Explainers saved" : r.error, r.ok ? "success" : "warning");
            })
          }
        >
          Save explainers
        </Button>
      </div>
    </Card>
  );
}

const blankQuestion = (): QuestionDraft => ({
  id: null,
  kind: "concept",
  prompt: "",
  scenario: "",
  explanation: "",
  options: [
    { text: "", isCorrect: true },
    { text: "", isCorrect: false },
  ],
});

function QuestionsCard({ conceptId, initial }: { conceptId: string; initial: QuestionDraft[] }) {
  const [list, setList] = useState(initial);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<QuestionDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const open = (i: number | null) => {
    setError(null);
    setEditing(i);
    setDraft(i === null ? blankQuestion() : structuredClone(list[i]));
  };
  const save = () =>
    start(async () => {
      if (!draft) return;
      const r = await saveQuestionAction(conceptId, draft.id, { ...draft, scenario: draft.scenario.trim() || null });
      if (!r.ok) return setError(r.error);
      const saved = { ...draft, id: r.id };
      setList((l) => (editing === null ? [...l, saved] : l.map((q, j) => (j === editing ? saved : q))));
      setDraft(null);
      setEditing(null);
      toast("Question saved", "success");
      router.refresh();
    });

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-extrabold">Questions ({list.length})</h2>
        <Button onClick={() => open(null)} disabled={Boolean(draft)}>
          <Plus size={18} aria-hidden /> New
        </Button>
      </div>
      <ol className="space-y-2">
        {list.map((q, i) => (
          <li key={q.id ?? i} className="flex items-center gap-3 rounded-2xl border border-line bg-obsidian px-4 py-3">
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-extrabold", q.kind === "application" ? "bg-royal-soft text-royal-bright" : "bg-surface-3 text-muted")}>{q.kind}</span>
            <span className="min-w-0 flex-1 truncate font-semibold">{q.prompt}</span>
            <Button size="sm" variant="ghost" onClick={() => open(i)} disabled={Boolean(draft)}>
              Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-label="Delete question"
              onClick={() =>
                start(async () => {
                  if (!q.id) return;
                  const r = await deleteQuestionAction(q.id);
                  if (r.ok) setList((l) => l.filter((_, j) => j !== i));
                })
              }
            >
              <Trash2 size={14} className="text-amber" />
            </Button>
          </li>
        ))}
      </ol>

      {draft && (
        <div className="mt-5 space-y-4 rounded-2xl border border-royal-bright/50 bg-obsidian p-5" aria-label="Question editor">
          <fieldset className="flex gap-2">
            <legend className="mb-1 text-sm font-bold text-muted">Type</legend>
            {(["concept", "application"] as const).map((k) => (
              <button key={k} type="button" aria-pressed={draft.kind === k} onClick={() => setDraft({ ...draft, kind: k })} className={cn("rounded-xl border px-3 py-1.5 text-sm font-bold", draft.kind === k ? "border-royal-bright bg-royal-soft" : "border-line text-muted")}>
                {k === "concept" ? "Concept quiz" : "Application (case identification)"}
              </button>
            ))}
          </fieldset>
          <Field label="Scenario (optional)" hint="A short business situation, shown above the question.">
            <textarea rows={2} className={inputCls} value={draft.scenario} onChange={(e) => setDraft({ ...draft, scenario: e.target.value })} />
          </Field>
          <Field label="Question">
            <textarea rows={2} className={inputCls} value={draft.prompt} onChange={(e) => setDraft({ ...draft, prompt: e.target.value })} />
          </Field>
          <fieldset>
            <legend className="mb-2 text-sm font-bold text-muted">Options (select the correct one)</legend>
            <ul className="space-y-2">
              {draft.options.map((o, i) => (
                <li key={i} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correct"
                    aria-label={`Option ${i + 1} is correct`}
                    checked={o.isCorrect}
                    onChange={() => setDraft({ ...draft, options: draft.options.map((x, j) => ({ ...x, isCorrect: j === i })) })}
                    className="size-4 accent-[var(--color-emerald)]"
                  />
                  <input
                    aria-label={`Option ${i + 1}`}
                    className={inputCls}
                    value={o.text}
                    onChange={(e) => setDraft({ ...draft, options: draft.options.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })}
                  />
                  <button type="button" aria-label={`Remove option ${i + 1}`} className="rounded-lg p-1.5 text-faint hover:text-amber" onClick={() => setDraft({ ...draft, options: draft.options.filter((_, j) => j !== i) })}>
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
            <Button size="sm" variant="ghost" className="mt-2" onClick={() => setDraft({ ...draft, options: [...draft.options, { text: "", isCorrect: false }] })}>
              <Plus size={16} aria-hidden /> Add option
            </Button>
          </fieldset>
          <Field label="Explanation" hint="Shown on Why? and when the learner gets it wrong.">
            <textarea rows={3} className={inputCls} value={draft.explanation} onChange={(e) => setDraft({ ...draft, explanation: e.target.value })} />
          </Field>
          {error && (
            <p role="alert" className="text-sm font-bold text-amber">
              {error}
            </p>
          )}
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => (setDraft(null), setEditing(null))}>
              Cancel
            </Button>
            <Button onClick={save} disabled={pending}>
              Save question
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
