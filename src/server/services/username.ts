import { Prisma } from "@prisma/client";
import type { Db } from "@/lib/db";
import { normalizeUsername } from "@/lib/username";

export type Availability = { available: boolean; reason?: string };

/** R9: is this name valid and free? Compared on the stored lowercase form (KTD7). */
export async function checkUsername(db: Db, raw: string): Promise<Availability> {
  const n = normalizeUsername(raw);
  if (!n.ok) return { available: false, reason: n.reason };
  const taken = await db.user.count({ where: { username: n.username } });
  return taken ? { available: false, reason: "taken" } : { available: true };
}

export type ClaimResult = { ok: true; username: string } | { ok: false; error: string };

export const TAKEN = "Username is already taken";

/**
 * Sets the username once (R10). The database's unique index decides a race:
 * the loser gets TAKEN and keeps their input. A user who already has a name
 * can't overwrite it here.
 */
export async function claimUsername(db: Db, userId: string, raw: string): Promise<ClaimResult> {
  const n = normalizeUsername(raw);
  if (!n.ok) return { ok: false, error: n.reason };
  try {
    const set = await db.user.updateMany({ where: { id: userId, username: null }, data: { username: n.username } });
    if (set.count === 0) return { ok: false, error: "You already have a username" };
    return { ok: true, username: n.username };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: false, error: TAKEN };
    throw e;
  }
}
