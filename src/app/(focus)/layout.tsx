import { AppShell } from "@/components/shell/AppShell";

export const dynamic = "force-dynamic";

/** Full-screen lesson view: same session chrome, no top navigation (Brilliant-style). */
export default function FocusLayout({ children }: { children: React.ReactNode }) {
  return <AppShell nav={false}>{children}</AppShell>;
}
