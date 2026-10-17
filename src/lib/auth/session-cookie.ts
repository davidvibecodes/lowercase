import { createHmac, timingSafeEqual } from "node:crypto";
import { cookiesSecure } from "@/lib/hosting";
import { SESSION_COOKIE } from "./constants";

export { SESSION_COOKIE };
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set. Run `npm run ensure-db` to generate .env.");
  return s;
}

/** HMAC with AUTH_SECRET; also signs the short-lived Google sign-in cookie (KTD2). */
export function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function signatureMatches(payload: string, sig: string): boolean {
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(payload));
  return a.length === b.length && timingSafeEqual(a, b);
}

/** How the session was created. Only a Google session can be admin (KTD5). */
export const AUTH_METHODS = ["google", "dev"] as const;
export type AuthMethod = (typeof AUTH_METHODS)[number];

export type VerifiedSession = { userId: string; method: AuthMethod };

/** Cookie value: base64url(userId).method.issuedAtSeconds.signature */
export function createSessionValue(userId: string, method: AuthMethod, now = Date.now()): string {
  const payload = `${Buffer.from(userId).toString("base64url")}.${method}.${Math.floor(now / 1000)}`;
  return `${payload}.${sign(payload)}`;
}

/** Returns the user id and method for a valid, unexpired value; otherwise null. */
export function verifySessionValue(value: string | undefined | null, now = Date.now()): VerifiedSession | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const [idPart, method, issuedPart, sig] = parts;
  if (!signatureMatches(`${idPart}.${method}.${issuedPart}`, sig)) return null;
  if (!(AUTH_METHODS as readonly string[]).includes(method)) return null;
  const issued = Number(issuedPart);
  if (!Number.isFinite(issued) || now / 1000 - issued > MAX_AGE_SECONDS) return null;
  try {
    const userId = Buffer.from(idPart, "base64url").toString("utf8");
    return userId ? { userId, method: method as AuthMethod } : null;
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: MAX_AGE_SECONDS,
  // Secure over https when hosted; plain http on loopback. A getter, so it follows the environment at use time.
  get secure() {
    return cookiesSecure();
  },
};

/** Reads the session cookie from a raw Cookie header (socket handshake). */
export function sessionValueFromCookieHeader(header: string | undefined): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === SESSION_COOKIE) return decodeURIComponent(v.join("="));
  }
  return null;
}
