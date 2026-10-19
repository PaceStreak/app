import { expect, test } from "@playwright/test";
import { newAccount, signIn } from "./helpers";

test("a journal entry and mood persist across a reload and are searchable", async ({ page }) => {
  const { email } = await newAccount("jrnl");
  await signIn(page, email);
  await page.goto("/journal");
  await page.getByRole("group", { name: "Mood" }).getByRole("button", { name: /Good/ }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
  await page.getByLabel("A line or two about the day").fill("Long walk by the canal, slept well.");
  await page.getByRole("button", { name: "Save note" }).click();
  await expect(page.getByRole("button", { name: "Save note" })).toBeDisabled();

  await page.reload();
  await expect(page.getByLabel("A line or two about the day")).toHaveValue("Long walk by the canal, slept well.");
  await expect(page.getByRole("group", { name: "Mood" }).getByRole("button", { name: /Good/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: /: Good$/ })).toHaveCount(1);

  await page.getByLabel("Find a day by what you wrote").fill("canal");
  await expect(page.getByRole("listitem").filter({ hasText: "Long walk by the canal, slept well." })).toHaveCount(1);
});
