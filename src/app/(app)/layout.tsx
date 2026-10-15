import { AuthProvider } from "@/lib/auth/AuthProvider";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { RealtimeBridge } from "@/lib/realtime/RealtimeBridge";
import { onlineUserIds } from "@/server/realtime/presence";
import { getUserProgress } from "@/server/services/progress";
import { GamificationHydrator } from "@/components/shell/GamificationHydrator";
import { InviteListener } from "@/components/shell/InviteListener";
import { TopNav } from "@/components/shell/TopNav";

// Every signed-in page is per-user and reads live data (KTD6).
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [progress, friends] = await Promise.all([
    getUserProgress(db, user.id),
    db.friendship.findMany({ where: { userId: user.id }, select: { friendId: true } }),
  ]);
  const online = new Set(onlineUserIds());
  const initialOnline = friends.map((f) => f.friendId).filter((id) => online.has(id));

  return (
    <AuthProvider user={user}>
      <GamificationHydrator xp={progress.xp} streak={progress.streak} />
      <RealtimeBridge initialOnline={initialOnline} />
      <TopNav xp={progress.xp} streak={progress.streak} />
      {children}
      <InviteListener />
    </AuthProvider>
  );
}
