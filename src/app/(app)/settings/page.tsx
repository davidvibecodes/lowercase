import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { AccountForm, Preferences, TestingControls } from "@/components/settings/SettingsForms";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await requireUser();
  const user = await db.user.findUniqueOrThrow({ where: { id: session.id } });
  return (
    <main className="mx-auto max-w-[720px] px-4 pb-24 pt-10 sm:px-6">
      <h1 className="text-3xl font-extrabold tracking-tight">Account</h1>
      <AccountForm user={{ firstName: user.firstName, lastName: user.lastName, email: user.email, username: session.username }} />
      <Preferences soundOn={user.soundOn} reducedMotion={user.reducedMotion} />
      <TestingControls isAdmin={session.isAdmin} gateMode={user.gateMode} />
    </main>
  );
}
