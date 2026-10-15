import { expect, test } from "@playwright/test";
import { loginOwner, loginPeer, OWNER_HOST } from "./helpers";

test("owner one-click login shows the admin shell; a peer on 127.0.0.1 stays signed in alongside", async ({ browser }) => {
  const david = await loginOwner(browser);
  const nav = david.page.getByRole("navigation", { name: "Primary" });
  for (const tab of ["Home", "Learn", "Friends & Groups", "You", "Admin CMS"]) await expect(nav.getByRole("link", { name: tab })).toBeVisible();
  await expect(david.page.getByLabel("3 day streak")).toBeVisible();
  await expect(david.page.getByLabel(/^\d+ XP$/)).toBeVisible();

  const roy = await loginPeer(browser, "roy");
  await expect(roy.page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Admin CMS" })).toHaveCount(0);
  await roy.page.getByRole("button", { name: "Account menu" }).click();
  await expect(roy.page.getByRole("menuitem", { name: "Admin Panel" })).toHaveCount(0);
  const res = await roy.page.goto("/admin");
  expect(res?.status()).toBe(404);

  // David is still signed in on localhost.
  await david.page.reload();
  await expect(david.page.getByRole("heading", { name: "Welcome, David!" })).toBeVisible();

  // Log out returns to /login.
  await david.page.getByRole("button", { name: "Account menu" }).click();
  await david.page.getByRole("menuitem", { name: "Log out" }).click();
  await expect(david.page).toHaveURL(`${OWNER_HOST}/login`);
  await david.ctx.close();
  await roy.ctx.close();
});

test("unknown peer usernames are refused", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto("http://127.0.0.1:3100/login/as/nobody");
  await expect(page.getByRole("alert").filter({ hasText: "No such test user" })).toBeVisible();
  await ctx.close();
});
