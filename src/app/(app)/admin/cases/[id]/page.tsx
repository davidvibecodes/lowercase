import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCaseAdmin } from "@/server/services/admin-cases";
import { CaseEditor } from "@/components/admin/CaseEditor";

export const metadata: Metadata = { title: "Edit case · Admin" };

export default async function EditCase({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getCaseAdmin(db, id);
  if (!c) notFound();
  const list = (kind: string) => c.items.filter((i) => i.kind === kind).map((i) => ({ id: i.id, text: i.text }));
  return (
    <CaseEditor
      meta={{ id: c.id, title: c.title, caseType: c.caseType, difficulty: c.difficulty, problemStatement: c.problemStatement, published: c.published }}
      lists={{ fact: list("fact"), hint: list("hint"), recommendation: list("recommendation"), observation: list("observation") }}
      transcript={c.transcript.map((t) => ({ speaker: t.speaker as "interviewer" | "candidate", text: t.text }))}
      tree={c.nodes.map((n) => ({ id: n.id, parentId: n.parentId, label: n.label, isCorrectPath: n.isCorrectPath, order: n.order }))}
    />
  );
}
