import { db } from "@/lib/db";
import { toSessionUser, type AuthProvider } from "./provider";

export function devLoginEnabled(): boolean {
  return process.env.AUTH_MODE === "dev";
}

/** Passwordless test login for seeded users. Refuses unless AUTH_MODE=dev (KTD5). */
export const devLoginProvider: AuthProvider = {
  id: "dev",
  async signIn({ username }) {
    if (!devLoginEnabled()) return { ok: false, error: "Test login is disabled (AUTH_MODE is not dev)." };
    const user = await db.user.findUnique({ where: { username: username.trim().toLowerCase() } });
    if (!user) return { ok: false, error: "No such test user" };
    return { ok: true, user: toSessionUser(user) };
  },
};

/** The active provider. Replace here when real authentication arrives. */
export const authProvider: AuthProvider = devLoginProvider;
