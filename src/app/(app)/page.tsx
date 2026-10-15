import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { getHomeData } from "@/server/services/home";
import { LearnPath } from "@/components/home/LearnPath";
import { LeagueCard } from "@/components/home/LeagueCard";
import { OnlineFriendsCard } from "@/components/home/OnlineFriendsCard";
import { StartCaseCard } from "@/components/home/StartCaseCard";
import { StreakCard } from "@/components/home/StreakCard";

export const metadata: Metadata = { title: "Home" };

export default async function HomePage() {
  const user = await requireUser();
  const data = await getHomeData(db, user.id);

  return (
    <main className="mx-auto max-w-[1200px] px-4 pb-24 pt-8 sm:px-6 lg:pt-12">
      <div className="grid gap-8 lg:grid-cols-[380px_1fr] lg:gap-10">
        <aside className="space-y-6">
          <h1 className="text-[28px] font-extrabold tracking-tight">Welcome, {user.firstName}!</h1>
          <StreakCard streak={data.progress.streak} bolts={data.progress.bolts} />
          <LeagueCard userId={user.id} league={data.league} groups={data.groups} />
          <OnlineFriendsCard friends={data.friends} />
        </aside>
        <section className="space-y-8 lg:pt-[60px]">
          <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6 sm:p-7">
            <LearnPath concepts={data.concepts} />
          </div>
          <StartCaseCard availability={data.availability} />
        </section>
      </div>
    </main>
  );
}
