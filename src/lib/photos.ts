/**
 * Progress photos, kept on this device and, when the person turns backup on,
 * copied to their account so they follow them to another phone. Each is re-encoded through a
 * canvas before it is stored: that caps its size (the longest side at 1600
 * px) and, as importantly, drops the EXIF data a camera writes - including
 * where the photo was taken.
 */

import { ApiError, api } from "./api";
import { uuid } from "./dates";
import { db, type Photo } from "./db";
import { prefs } from "./prefs";
import type { Me } from "./types";

const MAX_SIDE = 1600;

async function reencode(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't read that image"))), "image/jpeg", 0.85));
}

export async function addPhoto(file: Blob, date: string, pose: Photo["pose"]): Promise<Photo> {
  const photo: Photo = { id: uuid(), date, pose, blob: await reencode(file), created_at: new Date().toISOString() };
  await (await db()).put("photos", photo);
  if (prefs.photoBackup()) await upload(photo).catch(() => undefined);
  return photo;
}

/**
 * One request: the bytes go to the API with our auth like any other call,
 * typed by the blob, with the date and pose in the query. The API checks the
 * first bytes really are that image type before it stores anything, so a
 * 200 means it is backed up.
 */
async function upload(photo: Photo) {
  const q = new URLSearchParams({ date: photo.date, pose: photo.pose });
  try {
    await api(`/body-photos/${photo.id}?${q}`, { method: "PUT", blob: photo.blob });
  } catch (err) {
    // 409: the account's backup was turned off elsewhere; this device's mirror was stale.
    if (err instanceof ApiError && err.status === 409) prefs.setPhotoBackup(false);
    throw err;
  }
  await (await db()).put("photos", { ...photo, synced: true });
}

interface RemotePhoto {
  id: string;
  date: string;
  pose: Photo["pose"];
}

/**
 * Bring this device and the account level: upload what's only here, fetch
 * what's only there, and drop local copies of photos deleted elsewhere. Only
 * runs with backup on. Returns how many photos moved either way.
 */
export async function syncPhotos(): Promise<number> {
  if (!(await syncBackupSetting())) {
    await forgetSynced(); // turned off elsewhere: the server copies are gone
    return 0;
  }
  const store = await db();
  const local = await store.getAll("photos");
  const remote = await api<RemotePhoto[]>("/body-photos");
  const remoteIds = new Set(remote.map((r) => r.id));
  const localIds = new Set(local.map((p) => p.id));
  let moved = 0;
  for (const p of local) {
    if (remoteIds.has(p.id)) {
      if (!p.synced) await store.put("photos", { ...p, synced: true });
    } else if (p.synced) {
      await store.delete("photos", p.id); // deleted on another device
    } else {
      await upload(p);
      moved++;
    }
  }
  for (const r of remote) {
    if (localIds.has(r.id)) continue;
    // The API streams the bytes back to their owner (never cached). It is an
    // authenticated fetch, so the photo is shown from this device's copy
    // through an object URL, never by pointing an <img> at the API.
    let res: Response;
    try {
      res = await api<Response>(`/body-photos/${r.id}`, { raw: true });
    } catch {
      continue;
    }
    await store.put("photos", { id: r.id, date: r.date, pose: r.pose, blob: await res.blob(), created_at: new Date().toISOString(), synced: true });
    moved++;
  }
  return moved;
}

/**
 * What the backup setting should be, from the account's flag and this device's mirror. The account wins; the one
 * exception is the move from the old device-only setting: a device that says on, has uploaded before and has not
 * migrated yet turns the account on, once.
 */
export function resolveBackup(account: boolean, device: boolean, uploadedBefore: boolean, migrated: boolean): { on: boolean; migrate: boolean } {
  if (account) return { on: true, migrate: false };
  const migrate = !migrated && device && uploadedBefore;
  return { on: migrate, migrate };
}

/**
 * Level this device's mirror with the account (GET /me, or the `me` already in hand). Offline, the mirror stands.
 * Returns the setting in force.
 */
export async function syncBackupSetting(me?: Me): Promise<boolean> {
  let account: boolean;
  try {
    account = (me ?? (await api<Me>("/me"))).profile.photo_backup ?? false;
  } catch {
    return prefs.photoBackup();
  }
  let uploadedBefore = false;
  if (!account && prefs.photoBackup() && !prefs.photoBackupMigrated()) {
    try {
      uploadedBefore = (await (await db()).getAll("photos")).some((p) => p.synced);
    } catch {
      /* no local store: nothing was uploaded from here */
    }
  }
  const { on, migrate } = resolveBackup(account, prefs.photoBackup(), uploadedBefore, prefs.photoBackupMigrated());
  if (migrate) {
    try {
      await api("/me/profile", { method: "PATCH", body: { photo_backup: true } });
    } catch {
      return prefs.photoBackup(); // try again next time
    }
  }
  prefs.setPhotoBackupMigrated();
  prefs.setPhotoBackup(on);
  return on;
}

/** Turn backup on for the account (every device follows). */
export async function startPhotoBackup() {
  await api("/me/profile", { method: "PATCH", body: { photo_backup: true } });
  prefs.setPhotoBackupMigrated();
  prefs.setPhotoBackup(true);
}

/**
 * Turn backup off for the account: the API deletes every server copy in the same request as the flag. This device
 * keeps its own.
 */
export async function stopPhotoBackup() {
  await api("/me/profile", { method: "PATCH", body: { photo_backup: false } });
  prefs.setPhotoBackupMigrated();
  prefs.setPhotoBackup(false);
  const store = await db();
  for (const p of await store.getAll("photos")) if (p.synced) await store.put("photos", { ...p, synced: false });
}

async function forgetSynced() {
  try {
    const store = await db();
    for (const p of await store.getAll("photos")) if (p.synced) await store.put("photos", { ...p, synced: false });
  } catch {
    /* no local store */
  }
}

export async function listPhotos(): Promise<Photo[]> {
  try {
    const rows = await (await db()).getAll("photos");
    return rows.sort((a, b) => (a.date === b.date ? (a.created_at < b.created_at ? 1 : -1) : a.date < b.date ? 1 : -1));
  } catch {
    return [];
  }
}

export async function deletePhoto(id: string) {
  const store = await db();
  const photo = await store.get("photos", id);
  if (photo?.synced) await api(`/body-photos/${id}`, { method: "DELETE" });
  await store.delete("photos", id);
}
