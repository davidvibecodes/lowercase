import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { CasebankImport } from "@/components/admin/CasebankImport";

export const metadata: Metadata = { title: "Import casebank · Admin" };

export default async function ImportCasebankPage() {
  // Authorize at the page too: a crafted RSC request can render a page without its layout.
  await requireAdmin();
  return <CasebankImport />;
}
