import { expect, test } from "@playwright/test";
import { API, PASSWORD, auth, codeFor, emailEnabled, logMark, newAccount, signIn, turnstilePassed } from "./helpers";
import type { Page } from "@playwright/test";

async function password(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel(/email/i).first().fill(email);
  await page.getByLabel(/password/i).first().fill(PASSWORD);
  await turnstilePassed(page);
  const mark = logMark();
  await page.getByRole("button", { name: /^sign in$/i }).click();
  return mark;
}

async function signOut(page: Page) {
  await page.goto("/settings");
  await page.getByRole("button", { name: /sign out/i }).click();
  await expect(page).toHaveURL(/\/login/);
}

test("email codes: the code from the inbox signs in, and a trusted browser skips it next time", async ({ page }) => {
  test.skip(!(await emailEnabled()), "needs an API that sends email");
  const { email, handle } = await newAccount("ecode");
  const mark = await password(page, email);
  await expect(page.getByRole("heading", { name: "Check your email." })).toBeVisible();
  await expect(page.getByText(`We sent a 6-digit code to ${email}`)).toBeVisible();
  // Trust is ticked by default; resend waits out its cooldown.
  await expect(page.getByRole("checkbox", { name: /Trust this device for 30 days/ })).toBeChecked();
  await expect(page.getByRole("button", { name: /Send a new code in \d:\d\d/ })).toBeDisabled();
  await page.getByLabel("6-digit code").fill("000000");
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByLabel("6-digit code").fill(await codeFor(email, mark));
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page.getByRole("heading", { name: new RegExp(handle) })).toBeVisible({ timeout: 20_000 });

  // Signed out, then back in on the same browser: no code this time, and none mailed.
  await signOut(page);
  const again = await password(page, email);
  await expect(page.getByRole("heading", { name: new RegExp(handle) })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Check your email." })).toHaveCount(0);
  await expect(codeFor(email, again).then(() => "mailed", () => "none")).resolves.toBe("none");

  // The device is listed in Security, and forgetting it brings the code back.
  await page.goto("/settings/security");
  const devices = page.getByRole("list", { name: "Trusted devices" });
  await expect(devices.getByText("This device")).toBeVisible();
  await devices.getByRole("button", { name: "Forget" }).click();
  await expect(devices).toHaveCount(0);
  await signOut(page);
  await password(page, email);
  await expect(page.getByRole("heading", { name: "Check your email." })).toBeVisible();
});

test("email codes: a recovery code signs in instead, once", async ({ page }) => {
  test.skip(!(await emailEnabled()), "needs an API that sends email");
  const { email, token } = await newAccount("ercv");
  const res = await fetch(`${API}/auth/recovery-codes`, { method: "POST", headers: auth(token), body: JSON.stringify({ password: PASSWORD }) });
  const { recovery_codes } = (await res.json()) as { recovery_codes: string[] };
  expect(recovery_codes).toHaveLength(10);

  await password(page, email);
  await page.getByRole("button", { name: "Use a recovery code instead" }).click();
  await expect(page.getByLabel("Recovery code")).toBeVisible();
  await page.getByRole("checkbox", { name: /Trust this device/ }).uncheck();
  await page.getByLabel("Recovery code").fill(recovery_codes[0]);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });

  // Not trusted, so the next sign-in asks again; the spent code is refused.
  await signOut(page);
  await password(page, email);
  await page.getByRole("button", { name: "Use a recovery code instead" }).click();
  await page.getByLabel("Recovery code").fill(recovery_codes[0]);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("email codes: turning them off in Security needs the password, then the password alone signs in", async ({ page }) => {
  test.skip(!(await emailEnabled()), "needs an API that sends email");
  const { email } = await newAccount("eoff");
  await signIn(page, email);
  await page.goto("/settings/security");
  const toggle = page.getByRole("switch", { name: /Email me a code when I sign in/ });
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await toggle.click();
  const sheet = page.getByRole("dialog").filter({ hasText: "Turn off email codes" });
  await sheet.getByLabel("Your password").fill("not-the-password-at-all");
  await sheet.getByRole("button", { name: "Turn off" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /incorrect/i })).toBeVisible();
  await sheet.getByLabel("Your password").fill(PASSWORD);
  await sheet.getByRole("button", { name: "Turn off" }).click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");

  await signOut(page);
  await password(page, email);
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
});

test("email off: no code step and no email-code settings", async ({ page }) => {
  test.skip(await emailEnabled(), "the email-off flow");
  const { email } = await newAccount("enoc");
  await password(page, email);
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
  await page.goto("/settings/security");
  await expect(page.getByRole("heading", { name: "Recovery codes" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Email codes at sign-in" })).toHaveCount(0);
});
