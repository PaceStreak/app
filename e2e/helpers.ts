/** Accounts for end-to-end tests, made through the real API. */
import { execSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";

export const API = process.env.E2E_API ?? "http://localhost:8000/v1";
export const PASSWORD = "e2e-password-long-enough";
const TOKEN = "XXXX.DUMMY.TOKEN.XXXX";

/** The API's log, where console email prints verification codes. */
function apiLog(): string {
  if (process.env.E2E_API_LOG) return readFileSync(process.env.E2E_API_LOG, "utf8");
  return execSync("docker compose logs --since 10m api", { cwd: "../api", encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

/** Where the API log ends now, so a later code can be told from an earlier one. */
export function logMark(): number {
  return apiLog().length;
}

/** The newest 6-digit code emailed to `email`, logged after `since` (a logMark). */
export async function codeFor(email: string, since = 0): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const log = apiLog().slice(since);
    const at = log.lastIndexOf(`to=${email}`);
    const match = at >= 0 ? log.slice(at).match(/\b(\d{6})\b/) : null;
    if (match) return match[1];
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no verification code logged for ${email}`);
}

async function call(path: string, body: unknown, token?: string) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

let emailMode: Promise<boolean> | null = null;

/**
 * Whether the API under test sends email (`EMAIL_ENABLED`), from its public
 * GET /v1/config. Production runs with it off; specs that need emailed codes
 * run only when it is on, and email-off specs only when it is off.
 */
export function emailEnabled(): Promise<boolean> {
  emailMode ??= fetch(`${API}/config`)
    .then((r) => (r.ok ? r.json() : {}))
    .then((c: { email_enabled?: boolean }) => c.email_enabled === true);
  return emailMode;
}

/** An onboarded account, unique per call: verified when the API sends email, holding its signup recovery codes when not. */
export async function newAccount(prefix = "e2e") {
  const id = `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
  const email = `${id}@example.com`;
  const created = await call("/auth/signup", { email, password: PASSWORD, turnstile_token: TOKEN });
  const { access_token } = await apiSignIn(email);
  await call("/me/onboarding", { handle: id.slice(0, 30), birth_year: 1990, accept_terms: true }, access_token);
  return { email, handle: id.slice(0, 30), token: access_token as string, recoveryCodes: (created.recovery_codes ?? []) as string[] };
}

/**
 * POST /auth/login over plain fetch; with email on the API answers with an email-code challenge, finished here
 * with the code from the API log (no cookie jar, so nothing is trusted).
 */
export async function apiSignIn(email: string, password = PASSWORD): Promise<{ access_token: string }> {
  const mark = logMark();
  const res = await call("/auth/login", { email, password, turnstile_token: TOKEN });
  if (!res.mfa_required) return res;
  if (res.method !== "email") throw new Error(`apiSignIn cannot answer a ${res.method} challenge`);
  return call("/auth/2fa/verify", { mfa_token: res.mfa_token, code: await codeFor(email, mark), trust_device: false });
}

/** The code step after a password, when the API mails sign-in codes: the newest code since `mark`. */
export async function enterEmailCode(page: Page, email: string, mark: number) {
  await expect(page.getByRole("heading", { name: "Check your email." })).toBeVisible({ timeout: 20_000 });
  await page.getByLabel("6-digit code").fill(await codeFor(email, mark));
  await page.getByRole("button", { name: /^sign in$/i }).click();
}

/** Type the password; with email on, answer the code step too unless this browser is trusted. */
export async function submitPassword(page: Page, email: string, password = PASSWORD) {
  await page.getByLabel(/email/i).first().fill(email);
  await page.getByLabel(/password/i).first().fill(password);
  await turnstilePassed(page);
  const mark = logMark();
  await page.getByRole("button", { name: /^(sign in|log in)$/i }).click();
  if (!(await emailEnabled())) return;
  const step = page.getByRole("heading", { name: "Check your email." });
  // Either the code step shows, or a trusted browser goes straight in.
  await page.waitForFunction(() => !location.pathname.startsWith("/login") || document.querySelector("h1")?.textContent?.includes("Check your email"), undefined, { timeout: 20_000 });
  if (await step.isVisible()) await enterEmailCode(page, email, mark);
}

export async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await submitPassword(page, email);
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
}

/** The Turnstile test widget passes on its own; wait until its token exists. */
export async function turnstilePassed(page: Page) {
  await page.waitForFunction(
    () => Array.from(document.querySelectorAll<HTMLInputElement>('input[name="cf-turnstile-response"]')).some((i) => i.value.length > 0),
    undefined,
    { timeout: 20_000 },
  );
}

/** The sessions the server holds for this account. */
export async function serverWorkouts(token: string): Promise<{ discipline: string; distance_m: number | null; deleted_at: string | null }[]> {
  const res = await fetch(`${API}/workouts/changes?since=0`, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`changes: ${res.status}`);
  return (await res.json()).workouts.filter((w: { deleted_at: string | null }) => !w.deleted_at);
}

/** Quick-log a run from Today's sheet. */
export async function logRun(page: Page, km: string) {
  await page.getByRole("button", { name: /log a session/i }).first().click();
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await page.getByRole("button", { name: "30 min" }).click();
  await page.getByPlaceholder("0", { exact: true }).fill(km);
  await page.getByRole("button", { name: "Save run" }).click();
}

/** RFC 6238 TOTP (SHA-1, 6 digits, 30 s) for a base32 secret, `offset` steps from now. */
export function totp(secret: string, offset = 0): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of secret.replace(/[\s=]/g, "").toUpperCase()) bits += alphabet.indexOf(ch).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000) + offset));
  const mac = createHmac("sha1", key).update(msg).digest();
  const o = mac[mac.length - 1] & 0x0f;
  return String((mac.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

export const auth = (token: string) => ({ "content-type": "application/json", authorization: `Bearer ${token}` });
