import { expect, test } from "@playwright/test";
import { API, newAccount, signIn } from "./helpers";

async function putRun(token: string, hoursAgo: number) {
  const now = Date.now();
  const id = crypto.randomUUID();
  const res = await fetch(`${API}/workouts/${id}`, {
    method: "PUT",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({
      discipline: "run",
      started_at: new Date(now - hoursAgo * 3600_000).toISOString(),
      client_updated_at: new Date(now).toISOString(),
      duration_sec: 1800,
      distance_m: 5000,
    }),
  });
  expect(res.ok).toBe(true);
}

async function tagsOnServer(token: string) {
  const res = await fetch(`${API}/workouts/changes?since=0`, { headers: { authorization: `Bearer ${token}` } });
  return ((await res.json()).workouts as { tags?: string[]; deleted_at: string | null }[])
    .filter((w) => !w.deleted_at)
    .map((w) => (w.tags ?? []).join(","));
}

test("select sessions, tag them together, and undo", async ({ page }) => {
  const { email, token } = await newAccount("bulk");
  await putRun(token, 2);
  await putRun(token, 30);
  await signIn(page, email);
  await page.goto("/history");
  await page.getByRole("button", { name: "Select" }).click();
  for (const box of await page.getByRole("button", { name: /^Select Run/ }).all()) await box.click();
  await expect(page.getByText("2 selected")).toBeVisible();
  await page.getByRole("button", { name: "Tag" }).click();
  await page.getByLabel("Tag").fill("Deload week");
  await page.getByRole("button", { name: "Add tag" }).click();
  await expect.poll(() => tagsOnServer(token)).toEqual(["deload-week", "deload-week"]);

  await page.getByRole("button", { name: "Undo" }).click();
  await expect.poll(() => tagsOnServer(token)).toEqual(["", ""]);
});
