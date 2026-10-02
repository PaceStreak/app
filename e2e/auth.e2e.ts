import { expect, test } from "@playwright/test";
import { newAccount, signIn } from "./helpers";

test("sign in lands on Today; sign out returns to the login screen", async ({ page }) => {
  const { email, handle } = await newAccount("auth");
  await signIn(page, email);
  await expect(page.getByRole("heading", { name: new RegExp(handle) })).toBeVisible();
  await page.goto("/settings");
  await page.getByRole("button", { name: /sign out/i }).click();
  await expect(page).toHaveURL(/\/login/);
  // The refresh cookie went with the session: a reload stays signed out.
  await page.goto("/");
  await expect(page.getByRole("button", { name: /^sign in$/i })).toBeVisible();
});

test("a wrong password is refused with a message", async ({ page }) => {
  const { email } = await newAccount("bad");
  await page.goto("/login");
  await page.getByLabel(/email/i).first().fill(email);
  await page.getByLabel(/password/i).first().fill("not-the-password-at-all");
  await page.waitForFunction(() => Array.from(document.querySelectorAll<HTMLInputElement>('input[name="cf-turnstile-response"]')).some((i) => i.value));
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});
