import { expect, test } from "@playwright/test";
import { loginGoogle } from "./helpers";

test("a newcomer must choose a unique username before using the app (R7–R10)", async ({ browser }) => {
  const { ctx, page } = await loginGoogle(browser, { sub: "g-priya", email: "priya.n@gmail.com", name: "Priya Nair", givenName: "Priya", familyName: "Nair" });
  await expect(page.getByRole("heading", { name: "Choose your username" })).toBeVisible();

  // Every other page sends them back here.
  for (const path of ["/", "/friends", "/settings"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Choose your username" })).toBeVisible();
  }

  const input = page.getByLabel("Username");
  const save = page.getByRole("button", { name: "Save and continue" });
  await input.fill("Roy");
  await expect(page.getByText("✗ Username is already taken")).toBeVisible();
  await expect(save).toBeDisabled();
  await input.fill("9lives");
  await expect(page.getByText("Start with a letter")).toBeVisible();
  await expect(save).toBeDisabled();
  await input.fill("@Priya_Nair");
  await expect(page.getByText("✓ Username is available")).toBeVisible();
  await save.click();
  await expect(page.getByRole("heading", { name: "Welcome, Priya!" })).toBeVisible();

  await page.goto("/onboarding/username");
  await expect(page.getByRole("heading", { name: "Welcome, Priya!" })).toBeVisible();
  await page.goto("/settings");
  await expect(page.getByText("@priya_nair")).toBeVisible();
  await ctx.close();
});
