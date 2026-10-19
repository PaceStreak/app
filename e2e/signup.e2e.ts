import { expect, test } from "@playwright/test";
import { API, PASSWORD, codeFor, emailEnabled, logMark, newAccount, signIn, turnstilePassed } from "./helpers";

test("sign up, onboard with the terms, land on Today, then confirm the emailed code (email on) or keep the recovery codes (email off)", async ({ page }) => {
  const mail = await emailEnabled();
  const id = `su${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
  const email = `${id}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/password/i).first().fill(PASSWORD);
  await turnstilePassed(page);
  await page.getByRole("button", { name: "Create account" }).click();

  if (!mail) {
    // No email: the account's recovery codes come first, shown once, before onboarding.
    await expect(page.getByRole("heading", { name: "Save your recovery codes." })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("list", { name: "Recovery codes" }).getByRole("listitem")).toHaveCount(10);
    await expect(page.getByText(/sent|inbox|verify/i)).toHaveCount(0);
    await page.getByRole("button", { name: "I've saved them" }).click();
  }

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

  if (!mail) {
    // Nothing asks for a confirmed address, and the codes are in Security.
    await expect(page.getByText("Confirm your email")).toHaveCount(0);
    await page.goto("/settings/security");
    await expect(page.getByRole("heading", { name: "Email address" })).toBeVisible();
    await expect(page.getByText(/to unlock social features/)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Recovery codes" })).toBeVisible();
    await expect(page.getByText("10 left")).toBeVisible();
    return;
  }

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
  test.skip(!(await emailEnabled()), "needs an API that sends email");
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

test("email off: Forgot your password? leads to the recovery code, which sets a new one", async ({ page }) => {
  test.skip(await emailEnabled(), "the email-off flow");
  const { email, recoveryCodes } = await newAccount("fgt");
  expect(recoveryCodes).toHaveLength(10);
  const fresh = "a-brand-new-password-for-e2e";
  await page.goto("/login");
  await expect(page.getByRole("link", { name: "Lost access to your email?" })).toHaveCount(0);
  await page.getByRole("link", { name: "Forgot your password?" }).click();
  await expect(page).toHaveURL(/\/recover/);
  await expect(page.getByText(/email you|we sent|inbox/i)).toHaveCount(0);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Recovery code").fill(recoveryCodes[0]);
  await page.getByLabel("New password").fill(fresh);
  await turnstilePassed(page);
  await page.getByRole("button", { name: "Set new password" }).click();
  await expect(page.getByRole("heading", { name: "Password updated." })).toBeVisible();

  await page.goto("/login");
  await page.getByLabel(/email/i).first().fill(email);
  await page.getByLabel(/password/i).first().fill(fresh);
  await turnstilePassed(page);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
});

test("email off: the email-code screens send you where the job is done", async ({ page }) => {
  test.skip(await emailEnabled(), "the email-off flow");
  await page.goto("/forgot-password");
  await expect(page).toHaveURL(/\/recover/);
  await page.goto("/verify-email?email=x%40example.com");
  await expect(page).toHaveURL(/\/login/);
});

test("email off: settings show no email features, and the address changes with the password alone", async ({ page }) => {
  test.skip(await emailEnabled(), "the email-off flow");
  const { email, recoveryCodes } = await newAccount("set");
  await signIn(page, email);
  await page.goto("/settings/notifications");
  await expect(page.getByText("Everything lands in your inbox. Plus:")).toBeVisible();
  await expect(page.getByRole("switch", { name: /email$/ })).toHaveCount(0);
  await expect(page.getByText("No newsletters, no marketing email.")).toBeVisible();
  await page.goto("/settings/data");
  await expect(page.getByRole("heading", { name: "Backup by email" })).toHaveCount(0);

  await page.goto("/settings/security");
  const next = `new${email}`;
  await page.getByRole("button", { name: "Change", exact: true }).click();
  await page.getByLabel("New email address").fill(next);
  await page.getByLabel("Your password").fill(PASSWORD);
  await page.getByRole("button", { name: "Change email" }).click();
  await expect(page.getByText(next, { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/settings\/security/);

  // New recovery codes with the password; the signup set stops working.
  await page.getByRole("button", { name: "New codes" }).click();
  const sheet = page.getByRole("dialog").filter({ hasText: "New recovery codes" });
  await sheet.getByLabel("Your password").fill(PASSWORD);
  await sheet.getByRole("button", { name: "Make new codes" }).click();
  await expect(page.getByRole("dialog").filter({ hasText: "Your new recovery codes" }).getByRole("listitem")).toHaveCount(10);
  const stale = await fetch(`${API}/auth/recover`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: next, recovery_code: recoveryCodes[0], new_password: "whatever-long-password", turnstile_token: "x" }),
  });
  expect(stale.status).toBe(401);
});
