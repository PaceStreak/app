/**
 * Progress photos, kept on this device and, when the person turns backup on,
 * copied to their account so they follow them to another phone. Each is re-encoded through a
 * canvas before it is stored: that caps its size (the longest side at 1600
 * px) and, as importantly, drops the EXIF data a camera writes - including
 * where the photo was taken.
 */

import { api } from "./api";
import { uuid } from "./dates";
import { db, type Photo } from "./db";
import { prefs } from "./prefs";

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
 * Uploads go straight from this device to R2, not through the API - see
 * api/app/training/photos.py. The API hands out a presigned URL, this code
 * PUTs the bytes directly to it (a plain fetch, not `api()`: it's a
 * different origin, and it must carry neither our auth header nor cookies),
 * and then tells the API to verify what actually landed there before it
 * counts as backed up.
 */
async function upload(photo: Photo) {
  const body = { date: photo.date, pose: photo.pose, content_type: photo.blob.type };
  const { upload_url } = await api<{ upload_url: string }>(`/body-photos/${photo.id}/upload`, { body });
  const put = await fetch(upload_url, {
    method: "PUT",
    headers: { "Content-Type": photo.blob.type },
    body: photo.blob,
  });
  if (!put.ok) throw new Error("Photo upload failed");
  await api(`/body-photos/${photo.id}/upload/complete`, { body });
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
  if (!prefs.photoBackup()) return 0;
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
    // Fetching the photo is two hops: the API returns a presigned R2 URL
    // (never raw bytes), and this code fetches that plainly - again no auth
    // header or cookies, since a presigned URL carries its own permission.
    const { url } = await api<{ url: string }>(`/body-photos/${r.id}`);
    const res = await fetch(url);
    if (!res.ok) continue;
    await store.put("photos", { id: r.id, date: r.date, pose: r.pose, blob: await res.blob(), created_at: new Date().toISOString(), synced: true });
    moved++;
  }
  return moved;
}

/** Turn backup off: every copy on the server goes; this device keeps its own. */
export async function stopPhotoBackup() {
  await api("/body-photos", { method: "DELETE" });
  prefs.setPhotoBackup(false);
  const store = await db();
  for (const p of await store.getAll("photos")) if (p.synced) await store.put("photos", { ...p, synced: false });
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
