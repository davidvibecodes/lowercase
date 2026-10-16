import { resolve } from "node:path";
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

test("the owner imports a casebank: preview, confirm, then the case runs with guidance (R24, R26)", async ({ browser }) => {
  const { ctx, page } = await loginOwner(browser);
  await page.goto("/admin/cases");
  await page.getByRole("link", { name: "Import casebank" }).click();
  await page.locator("#casebank-file").setInputFiles(resolve(import.meta.dirname, "../fixtures/casebank-sample.json"));
  await expect(page.getByRole("heading", { name: "Preview" })).toBeVisible();
  await expect(page.getByText("2 to create, 0 to update")).toBeVisible();
  await page.getByRole("button", { name: "Confirm import" }).click();
  await expect(page.getByRole("heading", { name: "Result" })).toBeVisible();
  await expect(page.getByText("Applied")).toHaveCount(2);

  await page.goto("/admin/cases");
  await page.getByRole("listitem").filter({ hasText: "Corner Bakery" }).getByRole("link", { name: "Edit" }).click();
  await expect(page.getByText("Imported from the casebank as SAMPLE_001")).toBeVisible();
  await expect(page.getByText("4 nodes")).toBeVisible();
  await ctx.close();
});

