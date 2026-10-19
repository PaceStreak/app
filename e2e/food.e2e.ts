import { expect, test } from "@playwright/test";
import { API, auth, newAccount, signIn } from "./helpers";

test("log foods to meals and see the day's totals add up and survive a reload", async ({ page }) => {
  const { email, token } = await newAccount("food");
  await signIn(page, email);
  await page.goto("/food");
  const total = (label: string) => page.locator(".card", { has: page.getByText(label, { exact: true }) }).locator("p.num");

  const add = async (meal: string, name: string, servings: string, kcal: string, protein: string, save = false) => {
    await page.locator("section", { has: page.getByRole("heading", { name: new RegExp(`^${meal}`) }) }).getByRole("button", { name: "Add", exact: true }).click();
    const sheet = page.getByRole("dialog").filter({ hasText: "Add food" });
    await sheet.getByLabel("Name").fill(name);
    await sheet.getByLabel("Servings").fill(servings);
    await sheet.getByLabel("Calories per serving").fill(kcal);
    await sheet.getByLabel("Protein per serving").fill(protein);
    await sheet.getByRole("button", { name: save ? "Log and save food" : "Log it" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Logged" }).last()).toBeVisible();
  };
  await add("Breakfast", "Porridge", "1", "350", "12", true);
  await add("Lunch", "Chicken wrap", "2", "400", "30");

  await expect(total("Calories")).toHaveText(/^1150/);
  await expect(total("Protein")).toHaveText(/^72/);
  await expect(page.getByRole("heading", { name: "Lunch · 800 kcal" })).toBeVisible();
  await page.reload();
  await expect(total("Calories")).toHaveText(/^1150/);
  await expect(page.getByText("Chicken wrap")).toBeVisible();

  const today = new Date().toISOString().slice(0, 10);
  const day = await (await fetch(`${API}/nutrition/days/${today}`, { headers: auth(token) })).json();
  expect(day.totals.kcal).toBe(1150);
  expect(day.entries.map((e: { meal: string; name: string }) => `${e.meal}:${e.name}`).sort()).toEqual(["breakfast:Porridge", "lunch:Chicken wrap"]);

  // Removing one comes off the totals, with Undo.
  await page.getByRole("button", { name: "Remove Porridge" }).click();
  await expect(total("Calories")).toHaveText(/^800/);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(total("Calories")).toHaveText(/^1150/);
});
