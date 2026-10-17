import { expect, test, type Page } from "@playwright/test";
import { loginOwner, loginPeer, waitOnline } from "./helpers";

async function scoreAll(page: Page, score: number) {
  for (const label of ["Structure & MECE framework", "Hypothesis-driven approach", "Quantitative analysis", "Business judgment & insight", "Communication & synthesis", "Recommendation"]) {
    await page.getByRole("radio", { name: `${label}: ${score}` }).click();
  }
}

test("two players run a full live case, switch roles, and the result unlocks Level 2", async ({ browser }) => {
  const david = await loginOwner(browser);
  const roy = await loginPeer(browser, "roy");
  await waitOnline(david.page);
  await waitOnline(roy.page);

  // Invite from Friends & Groups; Roy sees the prompt on their home page.
  await david.page.goto("/friends");
  const royRow = david.page.getByTestId("friend-roy");
  await expect(royRow.getByText("Online")).toBeVisible();
  await royRow.getByRole("button", { name: "Start Session" }).click();
  const prompt = roy.page.getByRole("alertdialog", { name: /Session invite from David/ });
  await expect(prompt).toBeVisible();
  await prompt.getByRole("button", { name: "Join" }).click();

  // Both land in the same lobby.
  await expect(david.page).toHaveURL(/\/session\//);
  await expect(roy.page).toHaveURL(david.page.url().replace("localhost", "127.0.0.1"));

  // Roles: David interviews. Roy picks the case.
  await david.page.getByRole("radio", { name: /I'll interview/ }).click();
  await expect(roy.page.getByText("David is the interviewer.")).toBeVisible();
  await roy.page.getByRole("radio", { name: "Profitability" }).first().click();
  await roy.page.getByRole("radio", { name: "Level 1: Easy" }).click();
  await roy.page.getByRole("radio", { name: "Diagnostic Center – Mumbai" }).click();
  await expect(david.page.getByRole("radio", { name: "Diagnostic Center – Mumbai" })).toHaveAttribute("aria-checked", "true");
  await roy.page.getByRole("button", { name: "Ready", exact: true }).click();
  await david.page.getByRole("button", { name: "Ready", exact: true }).click();

  // Interviewer cockpit and interviewee workspace.
  await expect(david.page.getByRole("button", { name: "Reveal to Candidate" }).first()).toBeVisible();
  await expect(roy.page.getByText("Facts appear here as your interviewer reveals them")).toBeVisible();
  await expect(david.page.getByTestId("issue-tree")).toBeVisible();

  // Reveal three facts; measure the first one's latency on the other context.
  const facts = ["Colaba center", "Centralized path-laboratory", "Decrease in revenue"];
  let latency = 0;
  for (const [i, f] of facts.entries()) {
    const card = david.page.getByRole("listitem").filter({ hasText: f }).first();
    const t0 = Date.now();
    await card.getByRole("button", { name: "Reveal to Candidate" }).click();
    await expect(roy.page.getByTestId("revealed-fact")).toHaveCount(i + 1);
    if (i === 0) latency = Date.now() - t0;
  }
  const feed = await roy.page.getByTestId("revealed-fact").allInnerTexts();
  expect(feed[0]).toContain("Colaba");
  expect(feed[2]).toContain("Decrease in revenue");
  console.log(`[metric] reveal latency to other tab: ${latency} ms`);
  expect(latency).toBeLessThan(1000); // includes Playwright's own polling; the socket path is measured in unit tests

  // Interviewee gets a hint and writes notes; the interviewer sees "Hint used 1/3".
  await roy.page.getByRole("button", { name: /I'm Stuck/ }).click();
  await expect(roy.page.getByTestId("hint-card")).toContainText("Important to start by understanding");
  await expect(david.page.getByText("Hint used 1/3")).toBeVisible();
  await roy.page.getByLabel("Your notepad").fill("Profit = Revenue - Cost");
  await expect(roy.page.getByText("Saved", { exact: true })).toBeVisible();

  // Transcript slide-over.
  await david.page.getByRole("button", { name: "View Full Transcript" }).click();
  await expect(david.page.getByRole("dialog", { name: /Interview transcript · 33 turns/ })).toBeVisible();
  await david.page.keyboard.press("Escape");

  // Rubric: Mark Case Solved stays disabled until all six are scored.
  const solve = david.page.getByRole("button", { name: "Mark Case Solved" });
  await expect(solve).toBeDisabled();
  await scoreAll(david.page, 5);
  await david.page.getByRole("radio", { name: "Recommendation: 4" }).click();
  await expect(solve).toBeEnabled();
  await solve.click();
  await david.page.getByRole("button", { name: "Mark solved" }).click();

  // Both see the completion dialog.
  for (const p of [david.page, roy.page]) await expect(p.getByRole("dialog", { name: "Case solved!" })).toBeVisible();
  await expect(roy.page.getByRole("dialog", { name: "Case solved!" })).toContainText("4.8");

  // Switch roles → round 2 lobby with roles swapped.
  await roy.page.getByRole("button", { name: "Switch Roles" }).click();
  for (const p of [david.page, roy.page]) await expect(p.getByText("Round 2")).toBeVisible();
  await expect(roy.page.getByRole("radio", { name: /I'll interview/ })).toHaveAttribute("aria-checked", "true");

  // Roy now interviews, so the gate follows David's progress; Roy's own Level 2 unlocked.
  await david.page.getByRole("button", { name: "End session" }).click();
  await david.page.getByRole("dialog").getByRole("button", { name: "End session" }).click();
  await expect(david.page).toHaveURL(/\/$/);
  await expect(roy.page).toHaveURL(/\/$/);

  await roy.page.goto("/");
  await expect(roy.page.getByTestId("level-2")).toBeEnabled();
  await david.page.goto("/you?range=week");
  await expect(david.page.getByText("Cases solved", { exact: true }).locator("..")).toContainText("1");
  await expect(david.page.getByText("Activities completed", { exact: true }).locator("..")).toContainText("1");

  await david.ctx.close();
  await roy.ctx.close();
});
