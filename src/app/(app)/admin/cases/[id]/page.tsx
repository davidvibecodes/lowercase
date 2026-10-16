import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCaseAdmin, toSavedItem } from "@/server/services/admin-cases";
import { CaseEditor } from "@/components/admin/CaseEditor";
import type { NodeStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Edit case · Admin" };

export default async function EditCase({ params }: { params: Promise<{ id: string }> }) {
  // Authorize at the page too: a crafted RSC request can render a page without its layout.
  await requireAdmin();
  const { id } = await params;
  const c = await getCaseAdmin(db, id);
  if (!c) notFound();
  const list = (kind: string) => c.items.filter((i) => i.kind === kind).map(toSavedItem);
  // The editor works in stable node keys, so references survive every tree save (KTD11).
  const keyOf = new Map(c.nodes.map((n) => [n.id, n.key]));
  return (
    <CaseEditor
      meta={{
        id: c.id,
        title: c.title,
        caseType: c.caseType,
        difficulty: c.difficulty,
        problemStatement: c.problemStatement,
        published: c.published,
        externalId: c.externalId,
        industry: c.industry,
      }}
      lists={{ fact: list("fact"), hint: list("hint"), recommendation: list("recommendation"), observation: list("observation"), given: list("given") }}
      transcript={c.transcript.map((t) => ({ speaker: t.speaker as "interviewer" | "candidate", text: t.text }))}
      tree={c.nodes.map((n) => ({
        id: n.key,
        parentId: n.parentId ? (keyOf.get(n.parentId) ?? null) : null,
        label: n.label,
        isCorrectPath: n.isCorrectPath,
        order: n.order,
        status: n.status as NodeStatus,
        formula: n.formula,
      }))}
    />
  );
}
