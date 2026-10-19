import { expect, test } from "@playwright/test";
import { API, PASSWORD, auth, newAccount, signIn, totp, turnstilePassed } from "./helpers";

test("turn on two-factor, then sign in with a code from the authenticator", async ({ page }) => {
  const { email, handle } = await newAccount("tfa");
  await signIn(page, email);
  await page.goto("/settings/security");
  await page.getByRole("button", { name: "Set up" }).click();
  const sheet = page.getByRole("dialog").filter({ hasText: "Set up two-factor" });
  await expect(sheet.getByRole("img", { name: /QR code/ })).toBeVisible();
  const secret = (await sheet.locator("p.font-mono").innerText()).trim();
  expect(secret).toMatch(/^[A-Z2-7]{32}$/);
  await sheet.getByLabel("Code from the app").fill(totp(secret));
  await sheet.getByLabel("Your password").fill(PASSWORD);
  await sheet.getByRole("button", { name: "Turn on" }).click();
  const codes = page.getByRole("dialog").filter({ hasText: "Save your recovery codes" });
  await expect(codes.getByRole("listitem")).toHaveCount(10);
  await codes.getByRole("button", { name: "I've saved them" }).click();
  await expect(page.getByText("10 recovery codes left")).toBeVisible();

  await page.goto("/settings");
  await page.getByRole("button", { name: /sign out/i }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel(/email/i).first().fill(email);
  await page.getByLabel(/password/i).first().fill(PASSWORD);
  await turnstilePassed(page);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page.getByRole("heading", { name: "Two-factor code" })).toBeVisible();
  // The setup code's step is spent (replay protection); the next step is within the window.
  await page.getByLabel("Code").fill(totp(secret, 1));
  await page.getByRole("button", { name: /^sign in$/i }).click();
  // Signed in, and back where the sign-out happened.
  await expect(page).toHaveURL(/\/settings$/, { timeout: 20_000 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: new RegExp(handle) })).toBeVisible();
});

test("a recovery code sets a new password without email, and works only once", async ({ page }) => {
  const { email, token } = await newAccount("rcvr");
  const post = (path: string, body?: unknown) =>
    fetch(`${API}${path}`, { method: "POST", headers: auth(token), body: body ? JSON.stringify(body) : undefined }).then((r) => r.json());
  const { secret } = await post("/auth/2fa/setup");
  const { recovery_codes } = await post("/auth/2fa/enable", { password: PASSWORD, code: totp(secret) });
  const fresh = "recovered-password-long-enough";

  const recover = async () => {
    await page.goto("/recover");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Recovery code").fill(recovery_codes[0]);
    await page.getByLabel("New password").fill(fresh);
    await turnstilePassed(page);
    await page.getByRole("button", { name: "Set new password" }).click();
  };
  await recover();
  await expect(page.getByRole("heading", { name: "Password updated." })).toBeVisible();
  await recover();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Password updated." })).toHaveCount(0);
});
