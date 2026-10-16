import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { availableDevLogins, DEV_OWNER_USERNAME } from "@/lib/auth/dev-provider";
import { googleEnv } from "@/lib/auth/google";
import { getCurrentUser } from "@/lib/auth/guards";
import { loginErrorMessage } from "@/lib/auth/login-errors";
import { LoginForm } from "@/components/login/LoginForm";
import { Wordmark } from "@/components/shell/Wordmark";

export const metadata: Metadata = { title: "Log in" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getCurrentUser()) redirect("/");
  const { error } = await searchParams;
  const devLogins = await availableDevLogins();
  const owner = devLogins.find((a) => a.username === DEV_OWNER_USERNAME) ?? null;
  const peers = devLogins.filter((a) => a.username !== DEV_OWNER_USERNAME);

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(closest-side, #1d4ed855, transparent)" }}
      />
      <div className="relative w-full max-w-[440px]">
        <div className="mb-8 flex justify-center">
          <Wordmark size="lg" />
        </div>
        <div className="rounded-[var(--radius-card)] border border-line bg-surface p-7 shadow-2xl sm:p-8">
          <h1 className="text-[26px] font-extrabold leading-tight tracking-tight">Think like a consultant.</h1>
          <p className="mt-2 text-[15px] text-muted">Master frameworks, then crack live cases with a friend.</p>
          <LoginForm error={loginErrorMessage(error)} googleReady={googleEnv() !== null} owner={owner} peers={peers} />
        </div>
        <p className="mt-5 text-center text-xs text-faint">Sign in with your Google account. The test login appears only in local development.</p>
      </div>
    </main>
  );
}
