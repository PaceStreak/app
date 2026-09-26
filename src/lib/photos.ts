/**
 * Progress photos, kept on this device only. Each is re-encoded through a
 * canvas before it is stored: that caps its size (the longest side at 1600
 * px) and, as importantly, drops the EXIF data a camera writes - including
 * where the photo was taken.
 */

import { uuid } from "./dates";
import { db, type Photo } from "./db";

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
  return photo;
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
  await (await db()).delete("photos", id);
}
