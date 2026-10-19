import { expect, test } from "@playwright/test";
import { API, auth, newAccount, signIn } from "./helpers";

async function trashedHabit(token: string, name: string): Promise<string> {
  const habit = await (await fetch(`${API}/habits`, { method: "POST", headers: auth(token), body: JSON.stringify({ name }) })).json();
  const res = await fetch(`${API}/habits/${habit.id}`, { method: "DELETE", headers: auth(token) });
  expect(res.ok).toBe(true);
  return (await res.json()).trash_id;
}

test("restoring something already restored in another tab says it's gone", async ({ page, context }) => {
  const { email, token } = await newAccount("trsh");
  await trashedHabit(token, "Cold shower"); // labelled with its emoji, e.g. "✨ Cold shower"
  await signIn(page, email);
  await page.goto("/trash");
  const second = await context.newPage();
  await second.goto("/trash");
  await expect(second.getByText("Cold shower")).toBeVisible();

  await page.getByRole("button", { name: "Restore" }).click();
  await expect(page.getByRole("status").filter({ hasText: /Cold shower restored$/ })).toBeVisible();
  await second.getByRole("button", { name: "Restore" }).click();
  await expect(second.getByRole("alert").filter({ hasText: /Can't restore \S+ Cold shower: it's no longer in the trash/ })).toBeVisible();
  await expect(second.getByText("The trash is empty")).toBeVisible();
  // Restored once, not twice.
  const habits = await (await fetch(`${API}/habits`, { headers: auth(token) })).json();
  expect(habits.map((h: { name: string }) => h.name)).toEqual(["Cold shower"]);
});

test("restoring something deleted for good meanwhile says it's gone", async ({ page }) => {
  const { email, token } = await newAccount("forg");
  const trashId = await trashedHabit(token, "No sugar");
  await signIn(page, email);
  await page.goto("/trash");
  await expect(page.getByText("No sugar")).toBeVisible();
  expect((await fetch(`${API}/trash/${trashId}`, { method: "DELETE", headers: auth(token) })).ok).toBe(true);
  await page.getByRole("button", { name: "Restore" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /Can't restore \S+ No sugar: it's no longer in the trash/ })).toBeVisible();
  await expect(page.getByText("The trash is empty")).toBeVisible();
  expect(await (await fetch(`${API}/habits`, { headers: auth(token) })).json()).toEqual([]);
});

test("delete for good and empty the trash", async ({ page }) => {
  const { email, token } = await newAccount("empt");
  await trashedHabit(token, "Journal nightly");
  await trashedHabit(token, "Walk the dog");
  await signIn(page, email);
  await page.goto("/trash");
  await page.getByRole("button", { name: /^Delete .*Walk the dog for good$/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete for good" }).click();
  await expect(page.getByText("Walk the dog")).toHaveCount(0);
  await page.getByRole("button", { name: "Empty" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Empty trash" }).click();
  await expect(page.getByText("The trash is empty")).toBeVisible();
  expect(await (await fetch(`${API}/trash`, { headers: auth(token) })).json()).toEqual([]);
});
