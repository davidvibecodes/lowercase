import { AppShell } from "@/components/shell/AppShell";

// Every signed-in page is per-user and reads live data (KTD6).
export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
