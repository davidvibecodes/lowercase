import type { User } from "@prisma/client";
import type { Db } from "@/lib/db";
import type { GoogleClaims, GoogleErrorCode } from "@/lib/auth/google";
import { isUniqueViolation } from "./invites";

export type ResolveResult = { ok: true; user: User } | { ok: false; code: GoogleErrorCode };

/** Google profile photos only; anything else is dropped rather than rendered (KTD4). */
export function safeAvatarUrl(picture: string | undefined): string | null {
  if (!picture) return null;
  try {
    const u = new URL(picture);
    return u.protocol === "https:" && (u.hostname === "googleusercontent.com" || u.hostname.endsWith(".googleusercontent.com")) ? u.toString() : null;
  } catch {
    return null;
  }
}

function names(c: GoogleClaims): { firstName: string; lastName: string } {
  const [head = "", ...rest] = (c.name ?? "").trim().split(/\s+/);
  const firstName = (c.given_name?.trim() || head || c.email.split("@")[0]).slice(0, 40);
  const lastName = (c.family_name?.trim() ?? rest.join(" ")).slice(0, 40);
  return { firstName, lastName };
}

/**
 * Finds or creates the account for a verified Google identity (KTD4).
 * The Google `sub` is the key. A verified email links an existing account
 * only when that account has never been linked to Google, so the seeded
 * owner keeps their history; a different `sub` on the same email is refused.
 */
export async function resolveGoogleUser(db: Db, claims: GoogleClaims): Promise<ResolveResult> {
  if (claims.email_verified !== true) return { ok: false, code: "google_unverified" };
  const email = claims.email.trim().toLowerCase();
  const avatarUrl = safeAvatarUrl(claims.picture);

  const bySub = await db.user.findUnique({ where: { googleSub: claims.sub } });
  if (bySub) {
    const emailTaken = email !== bySub.email && (await db.user.count({ where: { email } })) > 0;
    const user = await db.user.update({ where: { id: bySub.id }, data: { avatarUrl, ...(emailTaken ? {} : { email }) } });
    return { ok: true, user };
  }

  const byEmail = await db.user.findUnique({ where: { email } });
  if (byEmail) {
    if (byEmail.isLeagueBot || byEmail.googleSub) return { ok: false, code: "google_conflict" };
    const linked = await db.user.updateMany({ where: { id: byEmail.id, googleSub: null }, data: { googleSub: claims.sub, avatarUrl } });
    if (linked.count === 0) return resolveAfterRace(db, claims);
    return { ok: true, user: await db.user.findUniqueOrThrow({ where: { id: byEmail.id } }) };
  }

  try {
    const user = await db.user.create({ data: { ...names(claims), email, googleSub: claims.sub, avatarUrl, username: null } });
    return { ok: true, user };
  } catch (e) {
    if (isUniqueViolation(e)) return resolveAfterRace(db, claims);
    throw e;
  }
}

/** Two simultaneous first callbacks: the loser reads what the winner wrote. */
async function resolveAfterRace(db: Db, claims: GoogleClaims): Promise<ResolveResult> {
  const user = await db.user.findUnique({ where: { googleSub: claims.sub } });
  return user ? { ok: true, user } : { ok: false, code: "google_conflict" };
}
