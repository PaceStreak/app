import { expect, test } from "@playwright/test";
import { API, auth, newAccount, signIn } from "./helpers";

test("start a group, a second account joins with its invite code, and both join a group challenge", async ({ page, browser }) => {
  const owner = await newAccount("gown");
  const friend = await newAccount("gfrd");
  await signIn(page, owner.email);
  await page.goto("/groups");
  await page.getByRole("button", { name: "Start a group" }).click();
  await page.getByLabel("Name").fill("Canal runners");
  await page.getByRole("button", { name: "Create group" }).click();
  await expect(page).toHaveURL(/\/groups\/[0-9a-f-]+$/);
  const groupUrl = new URL(page.url()).pathname;
  const code = (await page.getByText("Invite code").locator("xpath=following-sibling::p[1]").innerText()).trim();
  expect(code).toMatch(/^[a-z0-9]{4,16}$/);

  // The friend joins on their own phone.
  const other = await browser.newContext(test.info().project.use);
  const theirs = await other.newPage();
  await signIn(theirs, friend.email);
  await theirs.goto("/groups");
  await theirs.getByRole("button", { name: "Join with a code" }).click();
  await theirs.getByLabel("Invite code").fill(code);
  await theirs.locator("footer").getByRole("button", { name: "Join", exact: true }).click();
  await expect(theirs).toHaveURL(new RegExp(`${groupUrl}$`));
  await expect(theirs.getByRole("link", { name: new RegExp(owner.handle) })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("link", { name: new RegExp(friend.handle) })).toBeVisible();

  // The owner starts a group challenge; the friend joins it.
  await page.getByRole("group", { name: "Section" }).getByRole("button", { name: "Challenges" }).click();
  await page.getByRole("button", { name: "New group challenge" }).click();
  await page.getByLabel("Challenge name").fill("October days");
  await page.getByRole("button", { name: "Start challenge" }).click();
  await expect(page).toHaveURL(/\/challenges\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: "October days" })).toBeVisible();
  const challengeUrl = new URL(page.url()).pathname;

  await theirs.goto(challengeUrl);
  await theirs.getByRole("button", { name: "Join", exact: true }).click();
  await expect(theirs.getByRole("status").filter({ hasText: "You're in" })).toBeVisible();
  await expect(theirs.getByRole("button", { name: "Join", exact: true })).toHaveCount(0);

  const id = challengeUrl.split("/").pop();
  const c = await (await fetch(`${API}/challenges/${id}`, { headers: auth(owner.token) })).json();
  expect((c.leaderboard as { handle: string }[]).map((r) => r.handle).sort()).toEqual([owner.handle, friend.handle].sort());
  await other.close();
});
