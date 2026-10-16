/**
 * The one place usernames are normalised (KTD7, R8). Every write and lookup
 * goes through it, so the plain unique index on the stored lowercase value is
 * a case-insensitive uniqueness check.
 */
export const USERNAME_RULE = /^[a-z][a-z0-9._]{2,19}$/;

export type UsernameCheck = { ok: true; username: string } | { ok: false; reason: string };

/** Shared by the availability check, the save action and the onboarding form. */
export const TAKEN_REASON = "taken";
export const TAKEN = "Username is already taken";

export function normalizeUsername(raw: string): UsernameCheck {
  const username = raw.trim().replace(/^@/, "").toLowerCase();
  if (username.length < 3 || username.length > 20) return { ok: false, reason: "Use 3–20 characters" };
  if (!/^[a-z]/.test(username)) return { ok: false, reason: "Start with a letter" };
  if (!USERNAME_RULE.test(username)) return { ok: false, reason: "Use only letters a–z, digits, dots and underscores" };
  return { ok: true, username };
}
