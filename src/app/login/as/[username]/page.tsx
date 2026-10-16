import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { devLoginEnabled, isDevLoginUsername } from "@/lib/auth/dev-provider";
import { DevLoginButton } from "@/components/login/DevLoginButton";
import { Wordmark } from "@/components/shell/Wordmark";

export const metadata: Metadata = { title: "Peer tester" };
export const dynamic = "force-dynamic";

/**
 * Peer-tester entry (KTD4, KTD16), opened on the other loopback hostname. It
 * signs in only through the page's POST action, so a cross-site link can't
 * replace this browser's session.
 */
export default async function PeerTesterPage({ params }: { params: Promise<{ username: string }> }) {
  const username = decodeURIComponent((await params).username).toLowerCase();
  if (!devLoginEnabled() || !isDevLoginUsername(username)) notFound();
  const peer = await db.user.findUnique({ where: { username }, select: { firstName: true, lastName: true, googleSub: true } });
  if (!peer) notFound();
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-[440px]">
        <div className="mb-8 flex justify-center">
          <Wordmark size="lg" />
        </div>
        <div className="rounded-[var(--radius-card)] border border-line bg-surface p-7 sm:p-8">
          <h1 className="text-[22px] font-extrabold tracking-tight">Peer tester</h1>
          <p className="mb-6 mt-2 text-[15px] text-muted">
            Sign this tab in as {peer.firstName} {peer.lastName} to test live sessions with your main tab.
          </p>
          {peer.googleSub ? (
            <p role="alert" className="text-sm font-bold text-amber">
              This account signs in with Google, so the test login can&apos;t open it.
            </p>
          ) : (
            <DevLoginButton username={username} label={`Continue as ${peer.firstName} ${peer.lastName}`} />
          )}
        </div>
      </div>
    </main>
  );
}
