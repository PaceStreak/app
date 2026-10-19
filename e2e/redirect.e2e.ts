import { expect, test } from "@playwright/test";
import { PASSWORD, newAccount, turnstilePassed } from "./helpers";
import type { Page } from "@playwright/test";

async function submitLogin(page: Page, email: string) {
  await page.getByLabel(/email/i).first().fill(email);
  await page.getByLabel(/password/i).first().fill(PASSWORD);
  await turnstilePassed(page);
  await page.getByRole("button", { name: /^sign in$/i }).click();
}

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
