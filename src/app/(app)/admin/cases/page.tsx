import type { Metadata } from "next";
import { db } from "@/lib/db";
import { listCasesAdmin } from "@/server/services/admin-cases";
import { CaseList } from "@/components/admin/CaseList";

export const metadata: Metadata = { title: "Cases · Admin" };

export default async function AdminCases() {
  const cases = await listCasesAdmin(db);
  return (
    <CaseList
      cases={cases.map((c) => ({ id: c.id, title: c.title, caseType: c.caseType, difficulty: c.difficulty, published: c.published, nodes: c._count.nodes, turns: c._count.transcript }))}
    />
  );
}
