import { expect, test } from "@playwright/test";
import { loginPeer } from "./helpers";

/** Success criterion: local UI transitions commit in under 50 ms (no network round trip). */
test("option select and Check feedback commit in under 50 ms", async ({ browser }) => {
  const { ctx, page } = await loginPeer(browser, "ankit");
  await page.goto("/learn/porters-five-forces");
  const check = page.getByRole("button", { name: "Check" });
  for (let i = 0; i < 12 && !(await check.isVisible()); i++) {
    const h = await page.locator("main h1").innerText();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.locator("main h1")).not.toHaveText(h);
  }

  const timings = await page.evaluate(async () => {
    const timeUntil = (act: () => void, done: () => boolean) =>
      new Promise<number>((resolve) => {
        const t0 = performance.now();
        const obs = new MutationObserver(() => {
          if (done()) {
            obs.disconnect();
            resolve(performance.now() - t0);
          }
        });
        obs.observe(document.body, { subtree: true, attributes: true, childList: true, characterData: true });
        act();
      });
    const option = document.querySelectorAll<HTMLButtonElement>("[role=radio]")[1];
    const select = await timeUntil(
      () => option.click(),
      () => option.getAttribute("aria-checked") === "true",
    );
    const checkBtn = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Check")!;
    const check = await timeUntil(
      () => checkBtn.click(),
      () => /Correct|Not quite/.test(document.querySelector("footer")?.textContent ?? ""),
    );
    return { select, check };
  });
  console.log(`[metric] select ${timings.select.toFixed(1)} ms, check ${timings.check.toFixed(1)} ms`);
  expect(timings.select).toBeLessThan(50);
  expect(timings.check).toBeLessThan(50);
  await ctx.close();
});
