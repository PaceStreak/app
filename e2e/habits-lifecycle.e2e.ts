import { expect, test } from "@playwright/test";
import { newAccount, signIn } from "./helpers";

test("add a habit, tick it off, see the week and grid fill, delete with undo and restore from the trash", async ({ page }) => {
  const { email } = await newAccount("hab");
  await signIn(page, email);
  await page.goto("/habits");
  await expect(page.getByText("No habits yet")).toBeVisible();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByLabel("Search habits").fill("Stretch daily");
  await page.getByRole("button", { name: /Make your own: "Stretch daily"/ }).click();
  await page.getByRole("button", { name: "Add habit" }).click();
  await expect(page).toHaveURL(/\/habits\/[0-9a-f-]+$/);
  const url = page.url();

  await page.goto("/habits");
  const row = page.getByRole("button", { name: "Mark Stretch daily done" });
  const week = page.getByText(/\d\/\d this week/);
  // A habit made mid-week counts only the days left in it (7 on a Monday, 6 on a Tuesday...).
  await expect(week).toBeVisible();
  const target = (await week.textContent())?.match(/\/(\d)/)?.[1] ?? "7";
  await expect(week).toHaveText(new RegExp(`\\b0\\/${target} this week`));
  await row.click();
  await expect(page.getByRole("status").filter({ hasText: "Stretch daily: done" })).toBeVisible();
  await expect(week).toHaveText(new RegExp(`\\b1\\/${target} this week`));
  // The tick undoes itself.
  await page.getByRole("button", { name: "Stretch daily: done. Tap to undo." }).click();
  await expect(week).toHaveText(new RegExp(`\\b0\\/${target} this week`));
  await page.getByRole("button", { name: "Mark Stretch daily done" }).click();
  await expect(week).toHaveText(new RegExp(`\\b1\\/${target} this week`));

  // The month grid on the habit's page shows today as done.
  await page.goto(url);
  await expect(page.getByRole("grid").getByRole("button", { name: /: done$/ })).toHaveCount(1);

  // Delete, then Undo from the toast: back with its history.
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL(/\/habits$/);
  await expect(page.getByText("No habits yet")).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Stretch daily restored" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Stretch daily: done. Tap to undo." })).toBeVisible();

  // Delete again, and restore it from the trash instead.
  await page.goto(url);
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL(/\/habits$/);
  await page.goto("/trash");
  await expect(page.getByText("Habit · deleted")).toBeVisible();
  await page.getByRole("button", { name: "Restore" }).click();
  await expect(page.getByText("The trash is empty")).toBeVisible();
  await page.goto("/habits");
  await expect(page.getByRole("button", { name: "Stretch daily: done. Tap to undo." })).toBeVisible();
});
