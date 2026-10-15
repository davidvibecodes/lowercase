import { expect, test } from "@playwright/test";
import { loginOwner } from "./helpers";

test("an admin creates and publishes a concept that learners see on the home path", async ({ browser }) => {
  const { ctx, page } = await loginOwner(browser);
  await page.goto("/admin/concepts");
  await page.getByRole("button", { name: "New Concept" }).click();
  await page.getByLabel("Title").fill("BCG Matrix");
  await page.getByRole("button", { name: "Create draft" }).click();
  await expect(page).toHaveURL(/\/admin\/concepts\/.+/);

  await page.getByLabel("Published (visible to learners)").check();
  await page.getByRole("button", { name: "Save concept" }).click();
  await expect(page.getByText("Concept saved")).toBeVisible();

  await page.getByRole("button", { name: "New", exact: true }).click();
  await page.getByLabel("Question", { exact: true }).fill("A high-growth, high-share business is a…");
  await page.getByLabel("Option 1", { exact: true }).fill("Star");
  await page.getByLabel("Option 2", { exact: true }).fill("Dog");
  await page.getByLabel("Explanation").fill("Stars lead fast-growing markets.");
  await page.getByRole("button", { name: "Save question" }).click();
  await expect(page.getByText("Question saved")).toBeVisible();

  // Validation: no correct answer is rejected.
  await page.getByRole("button", { name: "New", exact: true }).click();
  await page.getByLabel("Question", { exact: true }).fill("Broken");
  await page.getByLabel("Option 1", { exact: true }).fill("A");
  await page.getByLabel("Option 2", { exact: true }).fill("B");
  await page.getByLabel("Explanation").fill("x");
  await page.getByRole("button", { name: "Remove option 1" }).click();
  await page.getByRole("button", { name: "Save question" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /Add at least two options|exactly one option/ })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();

  await page.goto("/");
  await expect(page.getByRole("link", { name: /BCG Matrix/ })).toBeVisible();
  await ctx.close();
});

test("the issue tree builder opens the Mumbai tree with 19 nodes", async ({ browser }) => {
  const { ctx, page } = await loginOwner(browser);
  await page.goto("/admin/cases");
  await page.getByRole("listitem").filter({ hasText: "Diagnostic Center – Mumbai" }).getByRole("link", { name: "Edit" }).click();
  await expect(page.getByText("19 nodes")).toBeVisible();
  await expect(page.locator(".react-flow__node")).toHaveCount(19);
  await ctx.close();
});
