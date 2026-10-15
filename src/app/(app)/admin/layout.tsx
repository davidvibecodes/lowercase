import { requireAdmin } from "@/lib/auth/guards";
import { AdminNav } from "@/components/admin/AdminNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-[1300px] px-4 pb-24 pt-8 sm:px-6">
      <AdminNav />
      {children}
    </div>
  );
}
