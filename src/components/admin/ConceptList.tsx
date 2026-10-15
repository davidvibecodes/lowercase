"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/components/ui/Toast";
import { createConceptAction, deleteConceptAction, moveConceptAction, publishConceptAction, type AdminResult } from "@/app/(app)/admin/concepts/actions";

type Row = { id: string; slug: string; title: string; published: boolean; questions: number; explainers: number };

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function ConceptList({ concepts }: { concepts: Row[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [title, setTitle] = useState("");

  const act = (fn: () => Promise<AdminResult>, ok?: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) toast(r.error, "warning");
      else {
        if (ok) toast(ok, "success");
        router.refresh();
      }
    });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-extrabold">Concepts</h2>
        <Button onClick={() => setCreating(true)}>
          <Plus size={18} aria-hidden /> New Concept
        </Button>
      </div>
      <ol className="space-y-2.5">
        {concepts.map((c, i) => (
          <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-3xl border border-line bg-surface px-4 py-3">
            <span className="w-6 text-center font-extrabold tabular-nums text-faint">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-extrabold">{c.title}</p>
              <p className="text-sm text-faint">
                /{c.slug} · {c.explainers} explainers · {c.questions} questions {c.published ? "" : "· Draft"}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" aria-label={`Move ${c.title} up`} disabled={i === 0 || pending} onClick={() => act(() => moveConceptAction(c.id, -1))}>
                <ArrowUp size={16} />
              </Button>
              <Button size="sm" variant="ghost" aria-label={`Move ${c.title} down`} disabled={i === concepts.length - 1 || pending} onClick={() => act(() => moveConceptAction(c.id, 1))}>
                <ArrowDown size={16} />
              </Button>
              <Button size="sm" variant="ghost" aria-label={c.published ? `Unpublish ${c.title}` : `Publish ${c.title}`} onClick={() => act(() => publishConceptAction(c.id, !c.published), c.published ? "Unpublished" : "Published")}>
                {c.published ? <Eye size={16} /> : <EyeOff size={16} />}
              </Button>
              <Link href={`/admin/concepts/${c.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-muted hover:bg-surface-2 hover:text-ink">
                <Pencil size={16} aria-hidden /> Edit
              </Link>
              <Button size="sm" variant="ghost" aria-label={`Delete ${c.title}`} onClick={() => setDeleting(c)}>
                <Trash2 size={16} className="text-amber" />
              </Button>
            </div>
          </li>
        ))}
      </ol>

      <Modal open={creating} onClose={() => setCreating(false)} title="New concept">
        <label className="text-sm font-bold text-muted" htmlFor="concept-title">
          Title
        </label>
        <input
          id="concept-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 h-11 w-full rounded-xl border border-line-strong bg-obsidian px-3 font-semibold outline-none focus:border-royal-bright"
          data-autofocus
        />
        <p className="mt-1 text-xs text-faint">URL: /learn/{slugify(title) || "…"}</p>
        <div className="mt-6 flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => setCreating(false)}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            disabled={!title.trim() || pending}
            onClick={() =>
              start(async () => {
                const r = await createConceptAction({ slug: slugify(title), title: title.trim(), summary: title.trim(), icon: "sparkles", published: false });
                if (!r.ok) return toast(r.error, "warning");
                setCreating(false);
                setTitle("");
                router.push(`/admin/concepts/${r.id}`);
              })
            }
          >
            Create draft
          </Button>
        </div>
      </Modal>

      <Modal open={Boolean(deleting)} onClose={() => setDeleting(null)} title={`Delete ${deleting?.title}?`}>
        <p className="text-muted">This deletes its explainers, questions and every learner&apos;s mastery for it.</p>
        <div className="mt-6 flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => setDeleting(null)} data-autofocus>
            Cancel
          </Button>
          <Button
            variant="warning"
            className="flex-1"
            onClick={() => {
              const d = deleting!;
              setDeleting(null);
              act(() => deleteConceptAction(d.id), "Concept deleted");
            }}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
