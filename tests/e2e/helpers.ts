import { expect, request, type Browser, type BrowserContext, type Page } from "@playwright/test";
import type { Persona } from "../helpers/fake-google";

export const PORT = 3100;
export const OWNER_HOST = `http://localhost:${PORT}`;
export const PEER_HOST = `http://127.0.0.1:${PORT}`;
export const FAKE_GOOGLE = "http://127.0.0.1:3199";

export const OWNER_PERSONA: Persona = { sub: "g-owner", email: "davidsathyandevice@gmail.com", name: "David Sathyan", givenName: "David", familyName: "Sathyan" };

/** Chooses who the fake Google signs in next (KTD3). */
export async function setGooglePersona(p: Persona) {
  const api = await request.newContext();
  const res = await api.post(`${FAKE_GOOGLE}/__persona`, { form: { persona: JSON.stringify(p) } });
  expect(res.status()).toBe(204);
  await api.dispose();
}

/** Signs in through "Continue with Google" on localhost as the given persona. */
export async function loginGoogle(browser: Browser, persona: Persona): Promise<{ ctx: BrowserContext; page: Page }> {
  await setGooglePersona(persona);
  const ctx = await browser.newContext({ baseURL: OWNER_HOST });
  const page = await ctx.newPage();
  await page.goto("/login");
  await page.getByRole("link", { name: "Continue with Google" }).click();
  return { ctx, page };
}

/** The owner signs in with Google, which is the only way to admin (R11). */
export async function loginOwner(browser: Browser): Promise<{ ctx: BrowserContext; page: Page }> {
  const r = await loginGoogle(browser, OWNER_PERSONA);
  await expect(r.page.getByRole("heading", { name: "Welcome, David!" })).toBeVisible();
  return r;
}

/** A brand-new Google user who picks a username on the onboarding step (R7). */
export async function loginNewcomer(browser: Browser, persona: Persona, username: string): Promise<{ ctx: BrowserContext; page: Page }> {
  const r = await loginGoogle(browser, persona);
  await expect(r.page.getByRole("heading", { name: "Choose your username" })).toBeVisible();
  await r.page.getByLabel("Username").fill(username);
  await expect(r.page.getByText("✓ Username is available")).toBeVisible();
  await r.page.getByRole("button", { name: "Save and continue" }).click();
  await expect(r.page.getByRole("heading", { name: /^Welcome, / })).toBeVisible();
  return r;
}

/** Signs a seeded friend in on the peer-tester host with the test login (KTD4). */
export async function loginPeer(browser: Browser, username: string): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ baseURL: PEER_HOST });
  const page = await ctx.newPage();
  await page.goto(`/login/as/${username}`);
  await page.getByRole("button", { name: /^Continue as / }).click();
  await expect(page.getByRole("heading", { name: /^Welcome, / })).toBeVisible();
  return { ctx, page };
}

/** Waits until the shell's own-connection badge reads Online. */
export async function waitOnline(page: Page) {
  await expect(page.getByRole("status").filter({ hasText: "Online" }).first()).toBeVisible();
}
