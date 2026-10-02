import { expect, test } from "@playwright/test";
import { logRun, newAccount, serverWorkouts, signIn } from "./helpers";

test("a quick-logged run reaches the server and survives a reload", async ({ page }) => {
  const { email, token } = await newAccount("log");
  await signIn(page, email);
  await logRun(page, "5");
  await expect.poll(async () => (await serverWorkouts(token)).map((w) => [w.discipline, w.distance_m])).toEqual([["run", 5000]]);
  await page.reload();
  await expect(page.getByRole("link", { name: /^Run 5\.00 km/ })).toBeVisible();
  expect(await serverWorkouts(token)).toHaveLength(1);
});

test("a run logged offline and left unsent survives sign-out and uploads on return", async ({ page, context }) => {
  const { email, token } = await newAccount("park");
  await signIn(page, email);
  // No signal for the API: every request to it fails, as on a dead connection.
  // (Playwright's setOffline also cuts the service worker off from its own
  // cache, which no real phone does, so the API is blocked instead.)
  const cut = (route: { abort: (e: string) => Promise<void> }) => route.abort("internetdisconnected");
  await context.route("http://localhost:8000/**", cut);
  await logRun(page, "7");
  await page.getByRole("link", { name: "You", exact: true }).last().click();
  await page.getByRole("link", { name: /settings/i }).first().click();
  await page.getByRole("button", { name: /sign out/i }).click();
  // The warning names what would otherwise be lost.
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(/haven't synced/i);
  await dialog.getByRole("button", { name: /sign out/i }).click();
  expect(await serverWorkouts(token)).toEqual([]);

  await context.unroute("http://localhost:8000/**", cut);
  await signIn(page, email);
  await expect.poll(async () => (await serverWorkouts(token)).map((w) => w.distance_m), { timeout: 20_000 }).toEqual([7000]);
});
