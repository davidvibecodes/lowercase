import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createSessionValue } from "@/lib/auth/session-cookie";
import { db, resetAndSeed } from "./helpers/db";

let cookieValue: string | undefined;
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (name === "lc_session" && cookieValue ? { name, value: cookieValue } : undefined) }),
}));

const route = await import("@/app/api/users/check-username/route");
const check = (q: string) => route.GET(new NextRequest(`http://localhost:3000/api/users/check-username?username=${encodeURIComponent(q)}`));

describe("GET /api/users/check-username (R9)", () => {
  beforeEach(async () => {
    await resetAndSeed();
    const newcomer = await db.user.create({ data: { firstName: "New", lastName: "Comer", email: "nc@gmail.com", googleSub: "g-nc" } });
    cookieValue = createSessionValue(newcomer.id, "google");
  });

  it("works before onboarding and answers case-insensitively", async () => {
    expect(await (await check("Roy")).json()).toEqual({ available: false, reason: "taken" });
    expect(await (await check("brand.new")).json()).toEqual({ available: true });
  });

  it("answers 401 to an invalid session", async () => {
    cookieValue = "not-a-real-cookie";
    expect((await check("anything")).status).toBe(401);
  });
});
