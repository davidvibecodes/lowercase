import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSignedIn } from "@/lib/auth/guards";
import { signOutAction } from "@/lib/auth/actions";
import { UsernameForm } from "@/components/onboarding/UsernameForm";
import { Wordmark } from "@/components/shell/Wordmark";

export const metadata: Metadata = { title: "Choose your username" };
export const dynamic = "force-dynamic";

/** The only page a signed-in user without a username can reach (R7). Outside AppShell, which would loop here. */
export default async function ChooseUsernamePage() {
  const user = await requireSignedIn();
  if (user.username) redirect("/");
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-[460px]">
        <div className="mb-8 flex justify-center">
          <Wordmark size="lg" />
        </div>
        <div className="rounded-[var(--radius-card)] border border-line bg-surface p-7 sm:p-8">
          <h1 className="text-[24px] font-extrabold tracking-tight">Choose your username</h1>
          <p className="mt-2 text-[15px] text-muted">
            Welcome, {user.firstName}! Friends find you only by this exact handle, so pick one you&apos;re happy to share. You can&apos;t change it later.
          </p>
          <UsernameForm />
        </div>
        <form action={signOutAction} className="mt-5 text-center">
          <button type="submit" className="text-sm font-semibold text-faint underline-offset-4 hover:text-muted hover:underline">
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
