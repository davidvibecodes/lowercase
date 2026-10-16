import type { User } from "@prisma/client";
import { isAdminEmail } from "./admin";
import type { AuthMethod } from "./session-cookie";

/** What the UI may know about the signed-in user. */
export type SessionUser = Pick<User, "id" | "username" | "firstName" | "lastName" | "email" | "avatarUrl"> & { isAdmin: boolean };

/** The single place admin is decided (R11, KTD5): a Google session on the admin email. */
export function toSessionUser(u: User, method: AuthMethod): SessionUser {
  return {
    id: u.id,
    username: u.username,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    avatarUrl: u.avatarUrl,
    isAdmin: method === "google" && isAdminEmail(u.email),
  };
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
