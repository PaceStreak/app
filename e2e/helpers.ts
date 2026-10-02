/** Accounts for end-to-end tests, made through the real API. */
import { execSync } from "node:child_process";
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

async function codeFor(email: string): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const log = apiLog();
    const at = log.lastIndexOf(email);
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

/** A verified, onboarded account, unique per call. */
export async function newAccount(prefix = "e2e") {
  const id = `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
  const email = `${id}@example.com`;
  await call("/auth/signup", { email, password: PASSWORD, turnstile_token: TOKEN });
  await call("/auth/verify-email", { email, code: await codeFor(email) });
  const { access_token } = await call("/auth/login", { email, password: PASSWORD, turnstile_token: TOKEN });
  await call("/me/onboarding", { handle: id.slice(0, 30), birth_year: 1990, accept_terms: true }, access_token);
  return { email, handle: id.slice(0, 30), token: access_token as string };
}

export async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel(/email/i).first().fill(email);
  await page.getByLabel(/password/i).first().fill(PASSWORD);
  await turnstilePassed(page);
  await page.getByRole("button", { name: /^(sign in|log in)$/i }).click();
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
