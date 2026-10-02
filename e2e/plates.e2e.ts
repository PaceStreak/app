import { expect, test } from "@playwright/test";
import { newAccount, signIn } from "./helpers";

test("load the bar fills the next set with the total", async ({ page }) => {
  const { email } = await newAccount("bar");
  await signIn(page, email);
  await page.goto("/workouts/live");
  await page.getByRole("button", { name: /add exercise/i }).click();
  await page.locator("input[type=search], input[placeholder*=earch]").first().fill("back squat");
  await page.locator("button:visible", { hasText: "Back squat" }).first().click();
  await page.getByRole("button", { name: "Plate calculator" }).first().click();
  await page.getByRole("button", { name: "Add 20 kg to each side" }).click();
  await page.getByRole("button", { name: "Add 1.25 kg to each side" }).click();
  await expect(page.getByText("62.5", { exact: false }).first()).toBeVisible();
  await page.getByRole("button", { name: "Use 62.5 kg" }).click();
  await expect(page.locator("input[inputmode=decimal]").first()).toHaveValue("62.5");
});
