import { createHmac, timingSafeEqual } from "node:crypto";
import { SESSION_COOKIE } from "./constants";

export { SESSION_COOKIE };
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set. Run `npm run ensure-db` to generate .env.");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** Cookie value: base64url(userId).issuedAtSeconds.signature */
export function createSessionValue(userId: string, now = Date.now()): string {
  const payload = `${Buffer.from(userId).toString("base64url")}.${Math.floor(now / 1000)}`;
  return `${payload}.${sign(payload)}`;
}

/** Returns the user id for a valid, unexpired value; otherwise null. */
export function verifySessionValue(value: string | undefined | null, now = Date.now()): string | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [idPart, issuedPart, sig] = parts;
  const expected = sign(`${idPart}.${issuedPart}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const issued = Number(issuedPart);
  if (!Number.isFinite(issued) || now / 1000 - issued > MAX_AGE_SECONDS) return null;
  try {
    return Buffer.from(idPart, "base64url").toString("utf8") || null;
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: MAX_AGE_SECONDS,
  secure: false, // local http only in this phase
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
