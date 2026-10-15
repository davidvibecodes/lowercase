import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { getGroupStandings } from "@/server/services/home";
import { listFriends } from "@/server/services/social";
import { FriendsTabs } from "@/components/friends/FriendsTabs";

export const metadata: Metadata = { title: "Friends & Groups" };

export default async function FriendsPage() {
  const user = await requireUser();
  const [friends, groups] = await Promise.all([listFriends(db, user.id), getGroupStandings(db, user.id)]);
  return (
    <main className="mx-auto max-w-[900px] px-4 pb-24 pt-10 sm:px-6">
      <h1 className="text-3xl font-extrabold tracking-tight">Friends &amp; Groups</h1>
      <p className="mt-1 text-muted">Start a live case with an online friend, or compete on a study group leaderboard.</p>
      <FriendsTabs userId={user.id} friends={friends} groups={groups} />
    </main>
  );
}
