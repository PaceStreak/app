import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { API, PASSWORD, auth, newAccount, signIn } from "./helpers";

test("profile edits persist, and an export downloads everything", async ({ page }) => {
  const { email, handle, token } = await newAccount("prof");
  await fetch(`${API}/habits`, { method: "POST", headers: auth(token), body: JSON.stringify({ name: "Floss" }) });
  await signIn(page, email);
  await page.goto("/settings/profile");
  await page.getByLabel("Name").fill("Grace Hopper");
  await page.getByLabel("Bio").fill("Compilers by day, intervals by night.");
  await page.getByRole("radio", { name: "Colour 4" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Profile saved" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();

  await page.reload();
  await expect(page.getByLabel("Name")).toHaveValue("Grace Hopper");
  await expect(page.getByLabel("Bio")).toHaveValue("Compilers by day, intervals by night.");
  await expect(page.getByRole("radio", { name: "Colour 4" })).toHaveAttribute("aria-checked", "true");
  const me = await (await fetch(`${API}/me`, { headers: auth(token) })).json();
  expect([me.profile.display_name, me.profile.bio, me.profile.avatar_hue]).toEqual(["Grace Hopper", "Compilers by day, intervals by night.", 90]);

  await page.goto("/settings/data");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /Everything \(JSON\)/ }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.json$/);
  const data = JSON.parse(readFileSync((await file.path())!, "utf8"));
  const text = JSON.stringify(data);
  expect(text).toContain(handle);
  expect(text).toContain("Floss");
  expect(text).toContain("Grace Hopper");
  // Busy state clears once the file is ready.
  await expect(page.getByText("Preparing…")).toHaveCount(0);

  const csv = page.waitForEvent("download");
  await page.getByRole("button", { name: /Spreadsheet \(CSV\)/ }).click();
  expect((await csv).suggestedFilename()).toMatch(/\.zip$/);
});

test("deleting the account signs out; signing back in offers to keep it", async ({ page }) => {
  const { email, token } = await newAccount("del");
  await signIn(page, email);
  await page.goto("/settings/data");
  await page.getByRole("button", { name: "Delete my account" }).click();
  const sheet = page.getByRole("dialog").filter({ hasText: "Delete your account" });
  await sheet.getByRole("textbox", { name: "Password" }).fill("not-the-password-at-all");
  await sheet.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete my account" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /password/i })).toBeVisible();
  await expect(page).toHaveURL(/\/settings\/data/);

  await sheet.getByRole("textbox", { name: "Password" }).fill(PASSWORD);
  await sheet.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete my account" }).click();
  await expect(page).toHaveURL(/\/login/);
  // Every session went with it.
  expect((await fetch(`${API}/me`, { headers: auth(token) })).status).toBe(401);

  await signIn(page, email);
  await expect(page.getByText("Your account is set to be deleted")).toBeVisible();
  await page.getByRole("button", { name: "Keep my account" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Your account is staying" })).toBeVisible();
  await expect(page.getByText("Your account is set to be deleted")).toHaveCount(0);
});
