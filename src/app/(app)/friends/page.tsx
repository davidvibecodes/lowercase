import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { listSocial } from "@/server/services/social";
import { FriendsTabs } from "@/components/friends/FriendsTabs";

export const metadata: Metadata = { title: "Friends & Groups" };

export default async function FriendsPage() {
  const user = await requireUser();
  const data = await listSocial(db, user.id);
  return (
    <main className="mx-auto max-w-[900px] px-4 pb-24 pt-10 sm:px-6">
      <h1 className="text-3xl font-extrabold tracking-tight">Friends &amp; Groups</h1>
      <p className="mt-1 text-muted">Find friends by their username, start a live case when they&apos;re online, or compete in a study group.</p>
      <FriendsTabs userId={user.id} username={user.username} data={data} />
    </main>
  );
}
