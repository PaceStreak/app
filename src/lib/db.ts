/**
 * On-device storage. IndexedDB, not localStorage: the whole training history
 * lives here so the app opens and logs with no signal, and localStorage's
 * 5MB synchronous string store is the wrong tool for that.
 *
 * - workouts: every session, synced from the server and edited locally.
 * - outbox:   writes waiting for the server, one entry per workout id; a
 *             newer edit replaces the queued one rather than queueing twice.
 * - kv:       small cached reads (me, stats, library) and the sync cursor.
 * - requests: body writes (weigh-ins, measures) made with no signal, sent
 *             in order when it returns. Keyed by path, so a second edit to
 *             the same entry replaces the queued one.
 * - photos:   progress photos. They never leave this device: nothing
 *             untrusted is hosted under pacestreak.com, and a photo of
 *             someone's body is the last thing that should be.
 * - parked:   one person's unsent writes and photos, set aside when they
 *             sign out or someone else signs in on this device, and put
 *             back when they sign in again. Never cleared by wipe(): a
 *             sign-out must not be able to lose a session that hasn't
 *             reached the server yet.
 */

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Workout } from "./types";

export interface OutboxOp {
  id: string;
  op: "put" | "delete";
  workout?: Workout;
  client_updated_at: string;
  attempts: number;
  error?: string | null;
}

export interface QueuedRequest {
  path: string;
  method: "PUT" | "DELETE";
  body?: unknown;
  queued_at: string;
}

export interface Photo {
  id: string;
  date: string;
  pose: "front" | "side" | "back";
  blob: Blob;
  created_at: string;
  /** Backed up to the account. */
  synced?: boolean;
}

export interface Parked {
  user_id: string;
  parked_at: string;
  outbox: OutboxOp[];
  requests: QueuedRequest[];
  photos: Photo[];
}

interface Schema extends DBSchema {
  parked: { key: string; value: Parked };
  workouts: { key: string; value: Workout; indexes: { by_date: string } };
  outbox: { key: string; value: OutboxOp };
  kv: { key: string; value: unknown };
  requests: { key: string; value: QueuedRequest };
  photos: { key: string; value: Photo; indexes: { by_date: string } };
}

let dbPromise: Promise<IDBPDatabase<Schema>> | null = null;

export function db() {
  dbPromise ??= openDB<Schema>("pacestreak", 3, {
    upgrade(database, oldVersion) {
      if (oldVersion < 1) {
        const workouts = database.createObjectStore("workouts", { keyPath: "id" });
        workouts.createIndex("by_date", "local_date");
        database.createObjectStore("outbox", { keyPath: "id" });
        database.createObjectStore("kv");
      }
      if (oldVersion < 2) {
        database.createObjectStore("requests", { keyPath: "path" });
        database.createObjectStore("photos", { keyPath: "id" }).createIndex("by_date", "date");
      }
      if (oldVersion < 3) {
        database.createObjectStore("parked", { keyPath: "user_id" });
      }
    },
  });
  return dbPromise;
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  try {
    return (await (await db()).get("kv", key)) as T | undefined;
  } catch {
    return undefined;
  }
}

export async function kvSet(key: string, value: unknown) {
  try {
    await (await db()).put("kv", value, key);
  } catch {
    /* storage full or unavailable (private mode): the app still works online */
  }
}

/** How many of this device's writes have not reached the server. */
export async function unsentCount(): Promise<number> {
  try {
    const d = await db();
    const [ops, reqs] = await Promise.all([d.count("outbox"), d.count("requests")]);
    return ops + reqs;
  } catch {
    return 0;
  }
}

/**
 * Set the signed-in person's unsent writes and on-device photos aside under
 * their id, merging with anything already parked for them. Nothing is parked
 * when there is nothing to keep, or when the owner is unknown.
 */
export async function park(userId: string | undefined) {
  if (!userId) return;
  const d = await db();
  const [outbox, requests, photos] = await Promise.all([d.getAll("outbox"), d.getAll("requests"), d.getAll("photos")]);
  if (!outbox.length && !requests.length && !photos.length) return;
  const prev = await d.get("parked", userId);
  const byKey = <T,>(rows: T[], key: (r: T) => string) => [...new Map(rows.map((r) => [key(r), r])).values()];
  await d.put("parked", {
    user_id: userId,
    parked_at: new Date().toISOString(),
    // Later entries win, so this device's newest edit replaces an older parked one.
    outbox: byKey([...(prev?.outbox ?? []), ...outbox], (o) => o.id),
    requests: byKey([...(prev?.requests ?? []), ...requests], (q) => q.path),
    photos: byKey([...(prev?.photos ?? []), ...photos], (p) => p.id),
  });
}

/** Put back whatever was parked for this person. Returns how many writes came back. */
export async function unpark(userId: string): Promise<number> {
  const d = await db();
  const parked = await d.get("parked", userId);
  if (!parked) return 0;
  const tx = d.transaction(["outbox", "requests", "photos", "workouts", "parked"], "readwrite");
  for (const op of parked.outbox) {
    await tx.objectStore("outbox").put(op);
    if (op.op === "put" && op.workout) await tx.objectStore("workouts").put({ ...op.workout, _pending: true });
  }
  for (const q of parked.requests) await tx.objectStore("requests").put(q);
  for (const p of parked.photos) await tx.objectStore("photos").put(p);
  await tx.objectStore("parked").delete(userId);
  await tx.done;
  return parked.outbox.length + parked.requests.length;
}

/**
 * Clear this device for the next person. The current owner's unsent writes
 * and photos are parked first, so they come back when that person returns.
 */
export async function wipe(ownerId?: string) {
  await park(ownerId);
  const d = await db();
  await Promise.all([d.clear("workouts"), d.clear("outbox"), d.clear("kv"), d.clear("requests"), d.clear("photos")]);
}

// Tiny change feed so hooks re-read after local or synced writes.
const listeners = new Set<() => void>();
export function onWorkoutsChanged(fn: () => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}
export function notifyWorkoutsChanged() {
  listeners.forEach((fn) => fn());
}

export async function allWorkouts(): Promise<Workout[]> {
  const rows = await (await db()).getAll("workouts");
  return rows
    .filter((w) => !w.deleted_at)
    .sort((a, b) => (a.started_at < b.started_at ? 1 : -1));
}

export async function getWorkout(id: string) {
  return (await db()).get("workouts", id);
}
