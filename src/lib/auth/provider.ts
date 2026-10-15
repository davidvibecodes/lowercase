import type { User } from "@prisma/client";

/** What the UI may know about the signed-in user. */
export type SessionUser = Pick<User, "id" | "username" | "firstName" | "lastName" | "email" | "isAdmin">;

export function toSessionUser(u: User): SessionUser {
  return { id: u.id, username: u.username, firstName: u.firstName, lastName: u.lastName, email: u.email, isAdmin: u.isAdmin };
}

export type SignInResult = { ok: true; user: SessionUser } | { ok: false; error: string };

/**
 * The swap-in seam for real authentication (R4). A future email/OAuth provider
 * implements this interface; cookies, guards and UI stay unchanged.
 */
export interface AuthProvider {
  readonly id: string;
  signIn(credentials: { username: string }): Promise<SignInResult>;
}
