import { expect, test } from "@playwright/test";
import { API, newAccount, signIn } from "./helpers";

test("a plan shows as a whole-plan calendar and opens a week from it", async ({ page }) => {
  const { email, token } = await newAccount("plan");
  const res = await fetch(`${API}/plans`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ template_id: "plan-five-by-five" }),
  });
  const plan = await res.json();
  await signIn(page, email);
  await page.goto(`/plans/${plan.id}`);
  await page.getByRole("button", { name: "Whole plan" }).click();
  const calendar = page.getByRole("table", { name: "Plan calendar" });
  await expect(calendar).toBeVisible();
  // Twelve weeks of three sessions.
  await expect(calendar.getByRole("button", { name: /^Week \d+, \w+: Five by five/ })).toHaveCount(36);
  await page.screenshot({ path: "test-results/plan-calendar.png", fullPage: true });
  await calendar.getByRole("button", { name: "Open week 5" }).click();
  await expect(page.getByRole("tab", { name: /Week 5/ })).toHaveAttribute("aria-selected", "true");
});
