import { AuthProvider } from "@/lib/auth/AuthProvider";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { RealtimeBridge } from "@/lib/realtime/RealtimeBridge";
import { onlineUserIds } from "@/server/realtime/presence";
import { getUserProgress } from "@/server/services/progress";
import { GamificationHydrator } from "./GamificationHydrator";
import { InviteListener } from "./InviteListener";
import { TopNav } from "./TopNav";

/** Signed-in chrome shared by every authenticated route group. */
export async function AppShell({ children, nav = true }: { children: React.ReactNode; nav?: boolean }) {
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
      {nav && <TopNav xp={progress.xp} streak={progress.streak} />}
      {children}
      <InviteListener />
    </AuthProvider>
  );
}
