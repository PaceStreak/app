import { expect, test } from "@playwright/test";
import { API, newAccount, signIn } from "./helpers";

const auth = (token: string) => ({ "content-type": "application/json", authorization: `Bearer ${token}` });
const post = (path: string, token: string, body: unknown) => fetch(`${API}${path}`, { method: "POST", headers: auth(token), body: JSON.stringify(body) });

test("a coach sees everyone sharing with them, and opens their coach tab", async ({ page }) => {
  const coach = await newAccount("coach");
  const athlete = await newAccount("athl");
  const group = await (await post("/groups", coach.token, { name: "Track club", kind: "coaching" })).json();
  const { invite_code } = await (await fetch(`${API}/groups/${group.id}`, { headers: auth(coach.token) })).json();
  expect((await post("/groups/join", athlete.token, { code: invite_code })).ok).toBe(true);
  await fetch(`${API}/groups/${group.id}/me`, { method: "PATCH", headers: auth(athlete.token), body: JSON.stringify({ shares_with_coach: true }) });

  await signIn(page, coach.email);
  await page.goto("/you");
  await page.getByRole("link", { name: /^Coaching/ }).click();
  await expect(page.getByText("1 sharing with you across 1 group")).toBeVisible();
  await expect(page.getByLabel("May need a check-in")).toBeVisible(); // nothing logged yet
  await page.getByRole("link", { name: new RegExp(athlete.handle) }).click();
  await expect(page).toHaveURL(new RegExp(`/groups/${group.id}\\?tab=coach`));
});
