import { expect, test } from "@playwright/test";
import { loginNewcomer, loginOwner, loginPeer, waitOnline } from "./helpers";

test("a newcomer finds Ankit by exact handle, Ankit accepts live, and they can start a session (R17–R19, R22)", async ({ browser }) => {
  const sam = await loginNewcomer(browser, { sub: "g-sam", email: "sam.k@gmail.com", name: "Sam Kim", givenName: "Sam", familyName: "Kim" }, "samk");
  const ankit = await loginPeer(browser, "ankit");
  await waitOnline(ankit.page);

  await sam.page.goto("/friends?tab=search");
  await expect(sam.page.getByText("Search by a user's unique username to find and invite them")).toBeVisible();
  await expect(sam.page.getByText("@samk")).toBeVisible();
  const box = sam.page.getByPlaceholder(/Search by exact username/);
  await box.fill("an");
  await expect(sam.page.getByText("No one has the username @an. Usernames must match exactly.")).toBeVisible();
  await box.fill("@ankit");
  const result = sam.page.getByTestId("search-result");
  await expect(result).toContainText("Ankit S");
  await expect(result).toContainText("@ankit");
  await result.getByRole("button", { name: "Add friend" }).click();
  await expect(result.getByRole("button", { name: "Requested · Cancel" })).toBeVisible();

  // Ankit's badge updates without a reload.
  const friendsTab = ankit.page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: /Friends & Groups/ });
  await expect(friendsTab).toContainText("1");
  await ankit.page.goto("/friends?tab=received");
  const row = ankit.page.getByRole("region", { name: "Friend requests for you" }).getByRole("listitem").filter({ hasText: "Sam Kim" });
  await expect(row).toContainText("@samk");
  await row.getByRole("button", { name: "Accept" }).click();
  await expect(ankit.page.getByText("You and Sam are friends")).toBeVisible();

  await sam.page.goto("/friends");
  const ankitRow = sam.page.getByTestId("friend-ankit");
  await expect(ankitRow).toContainText("Online");
  await expect(ankitRow.getByRole("button", { name: "Start Session" })).toBeEnabled();

  // Groups: search sits beside Create Group, and Sam can join the seeded group by name.
  await sam.page.goto("/friends?tab=groups");
  await sam.page.getByPlaceholder("Search groups by name...").fill("case club");
  const hit = sam.page.getByRole("region", { name: "Group search results" }).getByRole("listitem").filter({ hasText: "Case Club Squad" });
  await expect(hit).toContainText("By David Sathyan");
  await hit.getByRole("button", { name: "Join" }).click();
  await expect(hit).toContainText("Joined");
  await sam.page.getByPlaceholder("Search groups by name...").fill("");
  await expect(sam.page.getByTestId("group-Case Club Squad")).toContainText("Sam Kim");

  await sam.ctx.close();
  await ankit.ctx.close();
});

test("creating a group sends invites instead of adding people (R21)", async ({ browser }) => {
  const david = await loginOwner(browser);
  const roy = await loginPeer(browser, "roy");
  await david.page.goto("/friends?tab=groups");
  await david.page.getByRole("button", { name: /Create Group/ }).click();
  await david.page.getByLabel("Group name").fill("Pricing Pals");
  await david.page.getByRole("checkbox", { name: /Roy C/ }).check();
  await david.page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(david.page.getByText("Created Pricing Pals and sent 1 invite")).toBeVisible();

  await roy.page.goto("/friends?tab=received");
  const invite = roy.page.getByRole("region", { name: "Group invites for you" }).getByRole("listitem").filter({ hasText: "Pricing Pals" });
  await expect(invite).toContainText("From David Sathyan");
  await invite.getByRole("button", { name: "Join" }).click();
  await roy.page.goto("/friends?tab=groups");
  await expect(roy.page.getByTestId("group-Pricing Pals")).toContainText("Roy C");
  await david.ctx.close();
  await roy.ctx.close();
});
