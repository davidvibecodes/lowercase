import { expect, test } from "@playwright/test";
import { loginPeer } from "./helpers";

test("the Sound effects switch flips at once, sticks after a reload, and follows other tabs (R14, R15)", async ({ browser }) => {
  const { ctx, page } = await loginPeer(browser, "mihaela");
  await page.goto("/settings");
  const sound = page.getByRole("switch", { name: "Sound effects" });
  await expect(sound).toHaveAttribute("aria-checked", "true");
  await sound.click();
  await expect(sound).toHaveAttribute("aria-checked", "false");
  await expect(page.getByText("Preferences saved")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("switch", { name: "Sound effects" })).toHaveAttribute("aria-checked", "false");

  // A second tab turning it back on moves this tab's switch too.
  const other = await ctx.newPage();
  await other.goto("/settings");
  await other.getByRole("switch", { name: "Sound effects" }).click();
  await expect(other.getByRole("switch", { name: "Sound effects" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("switch", { name: "Sound effects" })).toHaveAttribute("aria-checked", "true");

  // Email comes from the account and can't be edited here.
  await expect(page.getByLabel("Email")).toHaveAttribute("readonly", "");
  await ctx.close();
});
