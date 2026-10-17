import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createSessionValue } from "@/lib/auth/session-cookie";
import { db, resetAndSeed, userId } from "./helpers/db";

// Drive the real guards: only the request cookie and Next's redirect are faked.
let cookieValue: string | undefined;
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
  notFound: () => {
    throw new Error("notFound");
  },
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (name === "lc_session" && cookieValue ? { name, value: cookieValue } : undefined) }),
}));

const guards = await import("@/lib/auth/guards");
const exportRoute = await import("@/app/api/export/route");

let owner: string, roy: string, newcomer: string;
beforeEach(async () => {
  await resetAndSeed();
  [owner, roy] = [await userId("davidsathyandevice"), await userId("roy")];
  newcomer = (await db.user.create({ data: { firstName: "New", lastName: "Comer", email: "new@gmail.com", googleSub: "g-new" } })).id;
  cookieValue = undefined;
});

const as = (id: string, method: "google" | "dev" = "google") => {
  cookieValue = createSessionValue(id, method);
};

describe("onboarding gate (R7)", () => {
  it("sends a user without a username to the username step, but lets the step itself through", async () => {
    as(newcomer);
    await expect(guards.requireUser()).rejects.toThrow("redirect:/onboarding/username");
    expect((await guards.requireSignedIn()).id).toBe(newcomer);
  });

  it("sends signed-out visitors to login", async () => {
    await expect(guards.requireSignedIn()).rejects.toThrow("redirect:/login");
    await expect(guards.requireUser()).rejects.toThrow("redirect:/login");
  });

  it("refuses the data export for a user without a username", async () => {
    as(newcomer);
    const res = await exportRoute.GET();
    expect(res.status).toBe(403);
    as(roy);
    expect((await exportRoute.GET()).status).toBe(200);
  });
});

describe("test-login sessions (KTD5)", () => {
  it("stop opening the account once it links Google or the test login is turned off", async () => {
    as(roy, "dev");
    expect((await guards.getCurrentUser())?.id).toBe(roy);

    vi.stubEnv("AUTH_MODE", "");
    try {
      expect(await guards.getCurrentUser()).toBeNull();
    } finally {
      vi.unstubAllEnvs();
    }

    await db.user.update({ where: { id: roy }, data: { googleSub: "g-roy" } });
    expect(await guards.getCurrentUser()).toBeNull();
    as(roy, "google");
    expect((await guards.getCurrentUser())?.id).toBe(roy);
  });
});

describe("admin pages and actions (R12, R13)", () => {
  it("redirects non-admins and dev-login sessions home", async () => {
    as(roy);
    await expect(guards.requireAdmin()).rejects.toThrow("redirect:/");
    as(owner, "dev");
    await expect(guards.requireAdmin()).rejects.toThrow("redirect:/");
    as(owner, "google");
    expect((await guards.requireAdmin()).id).toBe(owner);
  });

  it("assertAdmin throws a ServiceError the action wrappers can map", async () => {
    as(roy);
    await expect(guards.assertAdmin()).rejects.toMatchObject({ name: "Error", message: "Not authorized" });
    const { ServiceError } = await import("@/server/services/invites");
    await expect(guards.assertAdmin()).rejects.toBeInstanceOf(ServiceError);
  });
});

describe("adminRoute (KTD6)", () => {
  const handler = guards.adminRoute(async () => new Response("ok"));
  const post = (headers: Record<string, string>) => new NextRequest("http://localhost:3000/api/admin/x", { method: "POST", headers, body: "{}" });
  const ours = { origin: "http://localhost:3000", "content-type": "application/json" };

  it("responds 403 to non-admins before running the handler", async () => {
    as(roy);
    expect((await handler(post(ours))).status).toBe(403);
    as(owner, "dev");
    expect((await handler(post(ours))).status).toBe(403);
  });

  it("refuses an admin POST from another origin or without a JSON body", async () => {
    as(owner);
    expect((await handler(post({ ...ours, origin: "http://localhost:4000" }))).status).toBe(403);
    expect((await handler(post({ ...ours, "content-type": "text/plain" }))).status).toBe(403);
    expect((await handler(post({ "content-type": "application/json" }))).status).toBe(403);
  });

  it("runs the handler for an admin JSON POST from our own origin", async () => {
    as(owner);
    const res = await handler(post(ours));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  });
});
