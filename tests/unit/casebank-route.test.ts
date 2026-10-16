import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createSessionValue } from "@/lib/auth/session-cookie";
import { db, resetAndSeed, userId } from "./helpers/db";

let cookieValue: string | undefined;
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (name === "lc_session" && cookieValue ? { name, value: cookieValue } : undefined) }),
}));

const route = await import("@/app/api/admin/casebank/route");
const fixture = readFileSync(resolve(import.meta.dirname, "../fixtures/casebank-sample.json"), "utf8");

const post = (body: string, headers: Record<string, string> = {}) =>
  route.POST(
    new NextRequest("http://localhost:3000/api/admin/casebank", {
      method: "POST",
      body,
      headers: { origin: "http://localhost:3000", "content-type": "application/json", ...headers },
    }),
  );
const payload = (dryRun: boolean) => `{"dryRun":${dryRun},"document":${fixture}}`;

beforeEach(async () => {
  await resetAndSeed();
  cookieValue = createSessionValue(await userId("davidsathyandevice"), "google");
});

describe("POST /api/admin/casebank (R13, R24)", () => {
  it("previews for the admin without writing, then imports on confirm", async () => {
    const before = await db.case.count();
    const dry = await post(payload(true));
    expect(dry.status).toBe(200);
    expect((await dry.json()).cases.map((c: { action: string }) => c.action)).toEqual(["create", "create"]);
    expect(await db.case.count()).toBe(before);
    const real = await post(payload(false));
    expect((await real.json()).outcomes.map((o: { status: string }) => o.status)).toEqual(["applied", "applied"]);
    expect(await db.case.count()).toBe(before + 2);
  });

  it("refuses non-admins and test-login sessions with 403 and writes nothing", async () => {
    const before = await db.case.count();
    cookieValue = createSessionValue(await userId("roy"), "google");
    expect((await post(payload(false))).status).toBe(403);
    cookieValue = createSessionValue(await userId("davidsathyandevice"), "dev");
    expect((await post(payload(false))).status).toBe(403);
    expect(await db.case.count()).toBe(before);
  });

  it("refuses a cross-origin or non-JSON POST even from the admin", async () => {
    expect((await post(payload(false), { origin: "http://evil.example" })).status).toBe(403);
    expect((await post(payload(false), { "content-type": "text/plain" })).status).toBe(403);
  });

  it("refuses a body over 2 MB", async () => {
    const big = `{"dryRun":true,"document":{"pad":"${"x".repeat(2 * 1024 * 1024)}"}}`;
    expect((await post(big)).status).toBe(413);
  });

  it("explains invalid JSON and invalid casebanks", async () => {
    expect((await post("{nope")).status).toBe(400);
    const bad = await post(`{"dryRun":true,"document":{"schema_version":"1.0.0","cases":[]}}`);
    expect(bad.status).toBe(422);
    expect((await bad.json()).ok).toBe(false);
  });
});
