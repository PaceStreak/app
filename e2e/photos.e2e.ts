import { expect, test, type Page } from "@playwright/test";
import { API, newAccount, signIn } from "./helpers";

// A 1x1 PNG: the app re-encodes every photo through a canvas, so it needs a real image.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

async function backupOn(page: Page) {
  await page.goto("/body");
  await page.getByRole("switch", { name: /back up to your account/i }).click();
  await expect(page.getByText("Photos backed up to your account")).toBeVisible();
}

/** Every <img> in the front-photo grid has decoded (an object URL from this device's copy). */
async function expectRendered(page: Page, count: number) {
  const imgs = page.getByRole("list", { name: "front photos" }).locator("img");
  await expect(imgs).toHaveCount(count);
  await expect.poll(() => imgs.first().evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0 && i.src.startsWith("blob:"))).toBe(true);
}

test("a backed-up body photo uploads through the API and renders on another device", async ({ page, browser }) => {
  const { email, token } = await newAccount("photo");
  await signIn(page, email);
  await backupOn(page);
  await page.locator("#photo-input").setInputFiles({ name: "front.png", mimeType: "image/png", buffer: PNG });
  await expectRendered(page, 1);

  // On the server: one photo, re-encoded to JPEG, bytes served only with auth and never cached.
  await expect.poll(async () => (await (await fetch(`${API}/body-photos`, { headers: { authorization: `Bearer ${token}` } })).json()).length).toBe(1);
  const [remote] = await (await fetch(`${API}/body-photos`, { headers: { authorization: `Bearer ${token}` } })).json();
  const bytes = await fetch(`${API}/body-photos/${remote.id}`, { headers: { authorization: `Bearer ${token}` } });
  expect(bytes.status).toBe(200);
  expect(bytes.headers.get("content-type")).toBe("image/jpeg");
  expect(bytes.headers.get("cache-control")).toBe("private, no-store");
  expect((await fetch(`${API}/body-photos/${remote.id}`)).status).toBe(401);

  // A second device has nothing locally until backup is on there too; then it downloads and shows the photo.
  const other = await browser.newContext({ ...test.info().project.use });
  const second = await other.newPage();
  try {
    await signIn(second, email);
    await backupOn(second);
    await expectRendered(second, 1);
  } finally {
    await other.close();
  }
});
