/**
 * End-to-end tests: a real browser against a real API, Postgres and Redis.
 *
 * CI (.github/workflows/ci.yml) starts the API from PaceStreak/api with
 * Cloudflare's always-pass Turnstile test keys and console email; locally,
 * run `make dev` in api with the same two settings (see e2e/README.md).
 * The production build is served here on :5173 (the one origin the API's
 * CORS allows), service worker included, so offline behaves as it does for
 * real users rather than as the dev server's one-module-per-request does.
 */
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  testMatch: "*.e2e.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    timezoneId: "UTC",
    locale: "en-GB",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "mobile", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: "npx vite build --mode e2e && npx vite preview --port 5173 --strictPort",
    url: "http://localhost:5173",
    reuseExistingServer: false,
    timeout: 180_000,
    env: { PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA", PUBLIC_API_BASE_URL: "http://localhost:8000" },
  },
});
