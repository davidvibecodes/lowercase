import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";

export const PORT = 3100;
export const OWNER_HOST = `http://localhost:${PORT}`;
export const PEER_HOST = `http://127.0.0.1:${PORT}`;

/** Signs in via the one-click owner button on localhost. */
export async function loginOwner(browser: Browser): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ baseURL: OWNER_HOST });
  const page = await ctx.newPage();
  await page.goto("/login");
  await page.getByRole("button", { name: /Continue as davidsathyandevice/ }).click();
  await expect(page.getByRole("heading", { name: "Welcome, David!" })).toBeVisible();
  return { ctx, page };
}

/** Signs a seeded friend in on the peer-tester host (KTD4). */
export async function loginPeer(browser: Browser, username: string): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ baseURL: PEER_HOST });
  const page = await ctx.newPage();
  await page.goto(`/login/as/${username}`);
  await expect(page.getByRole("heading", { name: /^Welcome, / })).toBeVisible();
  return { ctx, page };
}

/** Waits until the shell's own-connection badge reads Online. */
export async function waitOnline(page: Page) {
  await expect(page.getByRole("status").filter({ hasText: "Online" }).first()).toBeVisible();
}
