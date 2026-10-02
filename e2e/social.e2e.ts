import { expect, test } from "@playwright/test";
import { API, newAccount, signIn } from "./helpers";

const auth = (token: string) => ({ "content-type": "application/json", authorization: `Bearer ${token}` });

test("a follower reacts to a session with a preset reaction", async ({ page }) => {
  const ana = await newAccount("ana");
  const ben = await newAccount("ben");
  // Followers-only (the default) would leave the follow waiting for approval.
  await fetch(`${API}/me/profile`, { method: "PATCH", headers: auth(ana.token), body: JSON.stringify({ visibility: "public" }) });
  const now = Date.now();
  await fetch(`${API}/workouts/${crypto.randomUUID()}`, {
    method: "PUT",
    headers: auth(ana.token),
    body: JSON.stringify({ discipline: "run", started_at: new Date(now - 3600_000).toISOString(), client_updated_at: new Date(now).toISOString(), duration_sec: 1800, distance_m: 5000 }),
  });
  expect((await fetch(`${API}/people/${ana.handle}/follow`, { method: "POST", headers: auth(ben.token) })).ok).toBe(true);

  await signIn(page, ben.email);
  await page.goto("/feed");
  await page.getByRole("button", { name: "Choose a reaction" }).first().click();
  await page.getByRole("button", { name: "On fire" }).click();
  await expect(page.getByRole("button", { name: /Remove your on fire/ })).toBeVisible();

  const feed = await (await fetch(`${API}/feed`, { headers: auth(ana.token) })).json();
  const reacted = feed.events.filter((e: { reactions?: Record<string, number> }) => Object.keys(e.reactions ?? {}).length);
  expect(reacted.map((e: { reactions: Record<string, number> }) => e.reactions)).toEqual([{ fire: 1 }]);
});
