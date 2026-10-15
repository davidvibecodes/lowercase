import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getConceptAdmin } from "@/server/services/admin-content";
import { ConceptEditor } from "@/components/admin/ConceptEditor";

export const metadata: Metadata = { title: "Edit concept · Admin" };

export default async function EditConcept({ params }: { params: Promise<{ id: string }> }) {
  // Authorize at the page too: a crafted RSC request can render a page without its layout.
  await requireAdmin();
  const { id } = await params;
  const c = await getConceptAdmin(db, id);
  if (!c) notFound();
  return (
    <ConceptEditor
      concept={{ id: c.id, slug: c.slug, title: c.title, summary: c.summary, icon: c.icon, published: c.published }}
      explainers={c.explainers.map((e) => ({ title: e.title, body: e.body }))}
      questions={c.questions.map((q) => ({
        id: q.id,
        kind: q.kind as "concept" | "application",
        prompt: q.prompt,
        scenario: q.scenario ?? "",
        explanation: q.explanation,
        options: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
      }))}
    />
  );
}
