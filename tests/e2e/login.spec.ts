import { expect, test } from "@playwright/test";
import { loginGoogle, loginOwner, loginPeer, OWNER_HOST, PEER_HOST } from "./helpers";

test("Continue with Google comes first; the Testing section offers seeded peers", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("link", { name: "Continue with Google" })).toBeVisible();
  const testing = page.getByRole("region", { name: "Testing" });
  await testing.getByRole("button", { name: "Open as Online Friend / Peer Tester" }).click();
  await expect(testing.getByRole("list", { name: "Peer testers" })).toContainText("Roy C");
});

test("the owner is admin through Google; a test-login peer can't reach the CMS", async ({ browser }) => {
  const david = await loginOwner(browser);
  const nav = david.page.getByRole("navigation", { name: "Primary" });
  for (const tab of ["Home", "Learn", "Friends & Groups", "You", "Admin CMS"]) await expect(nav.getByRole("link", { name: tab })).toBeVisible();
  await expect(david.page.getByLabel("3 day streak")).toBeVisible();

  const roy = await loginPeer(browser, "roy");
  await expect(roy.page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Admin CMS" })).toHaveCount(0);
  await roy.page.getByRole("button", { name: "Account menu" }).click();
  await expect(roy.page.getByRole("menuitem", { name: "Admin Panel" })).toHaveCount(0);
  for (const path of ["/admin", "/admin/cases", "/cms"]) {
    await roy.page.goto(path);
    await expect(roy.page).toHaveURL(`${PEER_HOST}/`);
  }

  // /cms takes the owner to the CMS.
  await david.page.goto("/cms");
  await expect(david.page).toHaveURL(`${OWNER_HOST}/admin`);

  // Log out returns to /login.
  await david.page.getByRole("button", { name: "Account menu" }).click();
  await david.page.getByRole("menuitem", { name: "Log out" }).click();
  await expect(david.page).toHaveURL(`${OWNER_HOST}/login`);
  await david.ctx.close();
  await roy.ctx.close();
});

test("once the owner has signed in with Google, the test login no longer offers their account", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: /Continue as davidsathyandevice/ })).toHaveCount(0);
});

test("cancelling at Google shows a fixed message", async ({ browser }) => {
  const { ctx, page } = await loginGoogle(browser, { sub: "g-cancel", email: "cancel@gmail.com", deny: true });
  await expect(page).toHaveURL(`${OWNER_HOST}/login?error=google_cancelled`);
  await expect(page.getByRole("alert").filter({ hasText: "Google" })).toHaveText("Google sign-in was cancelled.");
  await page.goto("/login?error=%3Cscript%3Ealert(1)%3C%2Fscript%3E");
  await expect(page.getByRole("alert").filter({ hasText: "signing in" })).toHaveText("Something went wrong signing in. Try again.");
  await ctx.close();
});

test("the peer tester link asks before signing in, and unknown accounts 404", async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: PEER_HOST });
  const page = await ctx.newPage();
  await page.goto("/login/as/mihaela");
  await expect(page.getByRole("heading", { name: "Peer tester" })).toBeVisible();
  expect((await ctx.cookies()).some((c) => c.name === "lc_session")).toBe(false);
  const res = await page.goto("/login/as/nobody");
  expect(res?.status()).toBe(404);
  await ctx.close();
});
