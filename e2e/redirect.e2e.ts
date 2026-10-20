import { expect, test } from "@playwright/test";
import { newAccount, submitPassword } from "./helpers";
import type { Page } from "@playwright/test";

/** The password, and the emailed code when the API sends one: `next` must survive the extra step. */
const submitLogin = (page: Page, email: string) => submitPassword(page, email);

test("a signed-out visit to a page returns there after signing in", async ({ page }) => {
  const { email } = await newAccount("next");
  await page.goto("/groups");
  await expect(page).toHaveURL(/\/login/);
  await submitLogin(page, email);
  await expect(page).toHaveURL(/\/groups$/, { timeout: 20_000 });
});

test("a protocol-relative next is ignored and sign-in lands on Today", async ({ page }) => {
  const { email, handle } = await newAccount("nxto");
  await page.goto("/login?next=//example.com");
  await submitLogin(page, email);
  await expect(page).toHaveURL(/^http:\/\/localhost:5173\/$/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: new RegExp(handle) })).toBeVisible();
});
