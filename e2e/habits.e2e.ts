import { expect, test } from "@playwright/test";
import { API, newAccount, signIn } from "./helpers";

test("a habit can be paused on its own and resumed", async ({ page }) => {
  const { email, token } = await newAccount("habit");
  const res = await fetch(`${API}/habits`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: "Morning run", days_mask: 0b0010101 }),
  });
  const habit = await res.json();
  expect(habit.weekly_target).toBe(3);

  await signIn(page, email);
  await page.goto(`/habits/${habit.id}`);
  await expect(page.getByText("Planned for Mon, Wed, Fri.")).toBeVisible();
  await page.getByRole("button", { name: /pause this habit/i }).click();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.getByText(/^Paused/).first()).toBeVisible();
  await page.getByRole("button", { name: /resume now/i }).click();
  await expect(page.getByRole("button", { name: /pause this habit/i })).toBeVisible();
});
