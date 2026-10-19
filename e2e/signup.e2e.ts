import { expect, test } from "@playwright/test";
import { PASSWORD, codeFor, logMark, newAccount, turnstilePassed } from "./helpers";

test("sign up, onboard with the terms, land on Today, then confirm the emailed code", async ({ page }) => {
  const id = `su${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
  const email = `${id}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/password/i).first().fill(PASSWORD);
  await turnstilePassed(page);
  await page.getByRole("button", { name: "Create account" }).click();

  // This API lets an unconfirmed address sign in, so signup goes straight to onboarding.
  await expect(page).toHaveURL(/\/welcome/, { timeout: 20_000 });

  // The handle follows the name until the handle itself is edited.
  await page.getByLabel("Name").pressSequentially("Ada Lovelace"); // typed, as a person would
  await expect(page.getByLabel("Handle")).toHaveValue("ada_lovelace");
  await page.getByLabel("Handle").fill(id);
  await page.getByLabel("Name").fill("Ada");
  await expect(page.getByLabel("Handle")).toHaveValue(id);
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByLabel("Birth year").fill("1990");
  const next = page.getByRole("button", { name: "Continue" });
  await expect(next).toBeDisabled(); // not without the terms
  await page.getByRole("checkbox").check();
  await next.click();
  await page.getByRole("button", { name: "Continue" }).click(); // how you train
  await page.getByRole("button", { name: "Continue" }).click(); // habits
  await page.getByRole("button", { name: "Start" }).click();

  await expect(page).toHaveURL(/\/$/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: /Ada/ })).toBeVisible();
  await expect(page.getByRole("dialog", { name: /updated the terms/ })).toHaveCount(0);

  // Confirm the address with the emailed code; the reminder goes away.
  await page.goto("/settings/security");
  await expect(page.getByText(`Confirm ${email} to unlock social features.`)).toBeVisible();
  const mark = logMark();
  await page.getByRole("button", { name: "Resend" }).click();
  await expect(page).toHaveURL(/\/verify-email/);
  await page.getByLabel("6-digit code").fill(await codeFor(email, mark));
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/settings/security");
  await expect(page.getByRole("heading", { name: "Email address" })).toBeVisible();
  await expect(page.getByText(`Confirm ${email} to unlock social features.`)).toHaveCount(0);
});

test("reset a forgotten password with the emailed code, then sign in with it", async ({ page }) => {
  const { email } = await newAccount("reset");
  const fresh = "a-brand-new-password-for-e2e";
  await page.goto("/login");
  await page.getByRole("link", { name: "Forgot your password?" }).click();
  await page.getByLabel("Email").fill(email);
  await turnstilePassed(page);
  const mark = logMark();
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page).toHaveURL(/\/reset-password/);
  await expect(page.getByLabel("Email")).toHaveValue(email);
  await page.getByLabel("6-digit code").fill(await codeFor(email, mark));
  await page.getByLabel("New password").fill(fresh);
  await page.getByRole("button", { name: "Set password" }).click();
  await expect(page.getByRole("heading", { name: "Password updated." })).toBeVisible();

  // The old password stops working; the new one signs in.
  await page.goto("/login");
  await page.getByLabel(/email/i).first().fill(email);
  await page.getByLabel(/password/i).first().fill(PASSWORD);
  await turnstilePassed(page);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByLabel(/password/i).first().fill(fresh);
  await turnstilePassed(page);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
});
