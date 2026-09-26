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
}

interface Schema extends DBSchema {
  workouts: { key: string; value: Workout; indexes: { by_date: string } };
  outbox: { key: string; value: OutboxOp };
  kv: { key: string; value: unknown };
  requests: { key: string; value: QueuedRequest };
  photos: { key: string; value: Photo; indexes: { by_date: string } };
}

let dbPromise: Promise<IDBPDatabase<Schema>> | null = null;

export function db() {
  dbPromise ??= openDB<Schema>("pacestreak", 2, {
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

/** Everything on this device - used when a different person signs in. */
export async function wipe() {
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
