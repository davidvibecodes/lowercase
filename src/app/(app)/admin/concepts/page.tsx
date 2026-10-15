import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { listConceptsAdmin } from "@/server/services/admin-content";
import { ConceptList } from "@/components/admin/ConceptList";

export const metadata: Metadata = { title: "Concepts · Admin" };

export default async function AdminConcepts() {
  // Authorize at the page too: a crafted RSC request can render a page without its layout.
  await requireAdmin();
  const concepts = await listConceptsAdmin(db);
  return (
    <ConceptList
      concepts={concepts.map((c) => ({ id: c.id, slug: c.slug, title: c.title, published: c.published, questions: c._count.questions, explainers: c._count.explainers }))}
    />
  );
}
