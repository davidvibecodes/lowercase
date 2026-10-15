import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { listFriends } from "@/server/services/social";
import { SessionClient } from "@/components/session/SessionClient";

export const metadata: Metadata = { title: "Case session" };

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const s = await db.caseSession.findUnique({ where: { id }, select: { hostId: true, guestId: true, status: true } });
  if (!s || (s.hostId !== user.id && s.guestId !== user.id)) {
    return (
      <main className="grid min-h-dvh place-items-center px-4 text-center">
        <div>
          <h1 className="text-2xl font-extrabold">This session is private</h1>
          <p className="mt-2 text-muted">Only the two players in a session can open it.</p>
          <Link href="/" className="mt-6 inline-block font-bold text-royal-bright hover:underline">
            Back to home
          </Link>
        </div>
      </main>
    );
  }
  if (s.status === "CLOSED") {
    return (
      <main className="grid min-h-dvh place-items-center px-4 text-center">
        <div>
          <h1 className="text-2xl font-extrabold">This session has ended</h1>
          <Link href="/" className="mt-6 inline-block font-bold text-royal-bright hover:underline">
            Back to home
          </Link>
        </div>
      </main>
    );
  }
  const friends = await listFriends(db, user.id);
  return <SessionClient sessionId={id} friends={friends} />;
}
