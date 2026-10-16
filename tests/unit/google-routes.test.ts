import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { verifySessionValue } from "@/lib/auth/session-cookie";
import { startFakeGoogle, type FakeGoogle } from "../helpers/fake-google";
import { db, resetAndSeed, userId } from "./helpers/db";

const start = await import("@/app/login/google/route");
const callback = await import("@/app/login/google/callback/route");
const { googleEnv, googleIssuer } = await import("@/lib/auth/google");

const ORIGIN = "http://localhost:3100";
const REDIRECT = `${ORIGIN}/login/google/callback`;
let fake: FakeGoogle;

beforeAll(async () => {
  fake = await startFakeGoogle();
});
afterAll(async () => {
  await fake.close();
});
beforeEach(async () => {
  await resetAndSeed();
  Object.assign(process.env, {
    GOOGLE_CLIENT_ID: "test-client-id",
    GOOGLE_CLIENT_SECRET: "test-client-secret",
    GOOGLE_REDIRECT_URI: REDIRECT,
    GOOGLE_OIDC_BASE_URL: fake.baseUrl,
    LC_FAKE_GOOGLE: "1",
  });
});

function cookieFrom(res: Response, name: string) {
  const set = res.headers.getSetCookie().find((c) => c.startsWith(`${name}=`));
  return set ? { raw: set, value: decodeURIComponent(set.split(";")[0].slice(name.length + 1)) } : null;
}

const startRequest = (host = "localhost:3100") => new NextRequest(`http://${host}/login/google`, { headers: { host } });

/** Start, then the fake Google, then back to the callback. */
async function signInThroughGoogle(opts: { tamperState?: boolean; dropCookie?: boolean; tamperCookie?: boolean } = {}) {
  const begin = await start.GET(startRequest());
  const oauth = cookieFrom(begin, "lc_oauth");
  const authorize = await fetch(begin.headers.get("location")!, { redirect: "manual" });
  const back = new URL(authorize.headers.get("location")!);
  if (opts.tamperState) back.searchParams.set("state", "forged");
  let cookie = oauth?.value ?? "";
  if (opts.tamperCookie) cookie = `${cookie.slice(0, -2)}xx`;
  const headers: Record<string, string> = opts.dropCookie ? {} : { cookie: `lc_oauth=${encodeURIComponent(cookie)}` };
  return callback.GET(new NextRequest(back, { headers }));
}

describe("Google sign-in routes (U4)", () => {
  it("starts on the pinned host with a signed one-time cookie and PKCE", async () => {
    const res = await start.GET(startRequest());
    const to = new URL(res.headers.get("location")!);
    expect(to.origin).toBe(fake.baseUrl);
    expect(to.searchParams.get("code_challenge_method")).toBe("S256");
    expect(to.searchParams.get("scope")).toBe("openid email profile");
    expect(to.searchParams.get("prompt")).toBe("select_account");
    expect(to.searchParams.get("redirect_uri")).toBe(REDIRECT);
    expect(cookieFrom(res, "lc_oauth")?.raw).toMatch(/HttpOnly/i);
    expect(cookieFrom(res, "lc_oauth")?.raw).toMatch(/Path=\/login\/google/);
  });

  it("bounces a 127.0.0.1 visitor to the pinned localhost host", async () => {
    const res = await start.GET(startRequest("127.0.0.1:3100"));
    expect(res.headers.get("location")).toBe(`${ORIGIN}/login/google`);
  });

  it("signs a newcomer in with a Google session and clears the one-time cookie", async () => {
    fake.setNextPersona({ sub: "g-ana", email: "ana@gmail.com", name: "Ana Lima" });
    const res = await signInThroughGoogle();
    expect(res.headers.get("location")).toBe(`${ORIGIN}/`);
    const session = cookieFrom(res, "lc_session");
    expect(session?.raw).toMatch(/HttpOnly/i);
    expect(session?.raw).toMatch(/SameSite=lax/i);
    const ana = await db.user.findUniqueOrThrow({ where: { googleSub: "g-ana" } });
    expect(verifySessionValue(session!.value)).toEqual({ userId: ana.id, method: "google" });
    expect(cookieFrom(res, "lc_oauth")?.raw).toMatch(/Max-Age=0/);
    // The fake refuses a code_verifier that doesn't hash to the challenge, so reaching here proves PKCE.
    expect(fake.verifiers.at(-1)).toBeTruthy();
  });

  it("links the owner, who is then signed in with a Google session", async () => {
    fake.setNextPersona({ sub: "g-owner", email: "davidsathyandevice@gmail.com", name: "David Sathyan" });
    const res = await signInThroughGoogle();
    expect(verifySessionValue(cookieFrom(res, "lc_session")!.value)).toEqual({ userId: await userId("davidsathyandevice"), method: "google" });
  });

  it("maps failures to fixed error codes and never sets a session", async () => {
    const cases: Array<[Parameters<typeof signInThroughGoogle>[0], { deny?: boolean; emailVerified?: boolean }, string]> = [
      [{}, { deny: true }, "google_cancelled"],
      [{ dropCookie: true }, {}, "google_expired"],
      [{ tamperCookie: true }, {}, "google_expired"],
      [{ tamperState: true }, {}, "google_failed"],
      [{}, { emailVerified: false }, "google_unverified"],
    ];
    for (const [opts, persona, code] of cases) {
      fake.setNextPersona({ sub: "g-x", email: "x@gmail.com", ...persona });
      const res = await signInThroughGoogle(opts);
      expect(res.headers.get("location"), code).toBe(`${ORIGIN}/login?error=${code}`);
      expect(cookieFrom(res, "lc_session"), code).toBeNull();
    }
  });

  it("explains a missing client instead of failing", async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    const res = await start.GET(startRequest());
    expect(res.headers.get("location")).toBe(`${ORIGIN}/login?error=google_unconfigured`);
  });

  it("ignores the fake IdP unless the test harness opts in with a loopback URL (KTD3)", () => {
    const env = googleEnv()!;
    expect(googleIssuer(env)).toBe(fake.baseUrl);
    delete process.env.LC_FAKE_GOOGLE;
    expect(googleIssuer(env)).toBe("https://accounts.google.com");
    process.env.LC_FAKE_GOOGLE = "1";
    process.env.GOOGLE_OIDC_BASE_URL = "http://evil.example";
    expect(googleIssuer(env)).toBe("https://accounts.google.com");
  });
});
