import { db } from "@/lib/db";
import { isHosted } from "@/lib/hosting";
import { toSessionUser, type AuthProvider } from "./provider";

/** AUTH_MODE=dev, and never on a hosted (public) server, whatever the environment says. */
export function devLoginEnabled(): boolean {
  return process.env.AUTH_MODE === "dev" && !isHosted();
}

/**
 * Seeded accounts the test login may sign in as (KTD5). Each is admitted only
 * while it has never signed in with Google, so a real friend's account can
 * never be opened by typing their handle.
 */
export const DEV_OWNER_USERNAME = "davidsathyandevice";
export const DEV_LOGIN_USERNAMES = [DEV_OWNER_USERNAME, "roy", "mihaela", "ankit"] as const;

export const isDevLoginUsername = (name: string): boolean => (DEV_LOGIN_USERNAMES as readonly string[]).includes(name);

/**
 * A test-login cookie stays good only while the test login would still admit
 * its account: AUTH_MODE is dev and the account has never signed in with
 * Google. Checked on every request and socket handshake, not just at sign-in,
 * so a peer-tester tab can't keep a real friend's account open after they link it.
 */
export function devSessionAllowed(user: { googleSub: string | null }): boolean {
  return devLoginEnabled() && user.googleSub === null;
}

/** Passwordless test login for seeded users. Refuses unless AUTH_MODE=dev; never admin. */
export const devLoginProvider: AuthProvider = {
  id: "dev",
  async signIn({ username }) {
    if (!devLoginEnabled()) return { ok: false, error: "Test login is disabled (AUTH_MODE is not dev)." };
    const name = username.trim().toLowerCase();
    if (!isDevLoginUsername(name)) return { ok: false, error: "No such test user" };
    const user = await db.user.findUnique({ where: { username: name } });
    if (!user || user.googleSub) return { ok: false, error: "This account signs in with Google" };
    return { ok: true, user: toSessionUser(user, "dev") };
  },
};

/** Seeded test accounts the dev login would admit right now (login page Testing section). */
export async function availableDevLogins() {
  if (!devLoginEnabled()) return [];
  const rows = await db.user.findMany({
    where: { username: { in: [...DEV_LOGIN_USERNAMES] }, googleSub: null },
    select: { username: true, firstName: true, lastName: true },
  });
  return DEV_LOGIN_USERNAMES.flatMap((u) => {
    const r = rows.find((x) => x.username === u);
    return r ? [{ username: u as string, firstName: r.firstName, lastName: r.lastName }] : [];
  });
}

export const authProvider: AuthProvider = devLoginProvider;
