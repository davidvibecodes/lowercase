import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { listCasesAdmin } from "@/server/services/admin-cases";
import { CaseList } from "@/components/admin/CaseList";

export const metadata: Metadata = { title: "Cases · Admin" };

export default async function AdminCases() {
  // Authorize at the page too: a crafted RSC request can render a page without its layout.
  await requireAdmin();
  const cases = await listCasesAdmin(db);
  return (
    <CaseList
      cases={cases.map((c) => ({ id: c.id, title: c.title, caseType: c.caseType, difficulty: c.difficulty, published: c.published, nodes: c._count.nodes, turns: c._count.transcript }))}
    />
  );
}
