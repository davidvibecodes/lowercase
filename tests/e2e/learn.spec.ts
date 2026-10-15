import { expect, test, type Page } from "@playwright/test";
import { loginPeer } from "./helpers";

/** Clicks Continue through the explainer cards until the first question's Check button shows. */
async function throughExplainers(page: Page) {
  const check = page.getByRole("button", { name: "Check" });
  for (let i = 0; i < 12 && !(await check.isVisible()); i++) {
    const heading = await page.locator("main h1").innerText();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.locator("main h1")).not.toHaveText(heading);
  }
  await expect(check).toBeVisible();
}

test("quit keeps nothing; Keep learning returns to the same question", async ({ browser }) => {
  const { ctx, page } = await loginPeer(browser, "ankit");
  const xpBefore = await page.getByLabel(/ XP$/).first().getAttribute("aria-label");
  await page.goto("/learn/vrio");
  await throughExplainers(page);
  const prompt = await page.locator("main h1").innerText();
  await page.getByRole("radio").first().click();
  await page.getByRole("button", { name: "Check" }).click();

  await page.getByRole("button", { name: "Quit lesson" }).click();
  await expect(page.getByRole("dialog", { name: "Are you sure?" })).toContainText("you will lose your progress and XP");
  await page.getByRole("button", { name: "Keep learning" }).click();
  await expect(page.locator("main h1")).toHaveText(prompt);

  await page.getByRole("button", { name: "Quit lesson" }).click();
  await page.getByRole("button", { name: "Quit", exact: true }).click();
  await expect(page).toHaveURL(/\/learn$/);
  await page.reload();
  expect(await page.getByLabel(/ XP$/).first().getAttribute("aria-label")).toBe(xpBefore);
  await expect(page.getByText("0/4 mastered").first()).toBeVisible();
  await ctx.close();
});

test("a fresh learner gets a full lesson, sees correct and incorrect states, and completion saves XP", async ({ browser }) => {
  const { ctx, page } = await loginPeer(browser, "mihaela");
  const xpOf = async () => Number((await page.getByLabel(/ XP$/).first().getAttribute("aria-label"))?.replace(/\D/g, ""));
  const xpBefore = await xpOf();
  await page.goto("/learn/case-type-identification");
  await throughExplainers(page);
  const total = await page.getByRole("progressbar", { name: "Lesson progress" }).getAttribute("aria-valuemax");
  expect(Number(total)).toBe(3 + 6); // 3 explainers + 6 questions (pool of 6, target 6–8)

  for (let i = 0; i < 6; i++) {
    const options = page.getByRole("radio");
    await options.first().click();
    await page.getByRole("button", { name: "Check" }).click();
    await expect(page.getByText(/✕ Not quite|✓ Correct!/)).toBeVisible();
    if (await page.getByText("✕ Not quite").isVisible()) {
      await page.getByRole("button", { name: "Why?" }).click();
      await expect(page.getByTestId("why-panel")).toBeVisible();
      await page.getByRole("button", { name: "See Answer" }).click();
    } else {
      await expect(page.getByText("✓ Correct!")).toBeVisible();
    }
    await page.getByRole("button", { name: "Continue" }).click();
  }
  await expect(page.getByRole("heading", { name: "Lesson complete!" })).toBeVisible();
  await expect(page.getByText("XP earned")).toBeVisible();
  // Completion persists: a reload shows more XP than before the lesson.
  await page.goto("/learn");
  expect(await xpOf()).toBeGreaterThan(xpBefore);
  await ctx.close();
});
