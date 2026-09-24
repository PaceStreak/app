/**
 * Offline-first sync for workouts.
 *
 * Every save lands in IndexedDB first and the UI reads from there, so a log
 * is instant and survives a dead connection, a closed tab or a crashed
 * phone. The outbox then pushes to /workouts/batch whenever it can; the API
 * is idempotent per workout id and last-write-wins on client_updated_at, so
 * retrying is always safe.
 *
 * Pulling uses the API's sequence cursor (/workouts/changes?since=N), which
 * includes deletions, so another device's edits and deletes arrive here too.
 */

import { ApiError, NetworkError, api, isAuthenticated } from "./api";
import { db, kvGet, kvSet, notifyWorkoutsChanged, type OutboxOp } from "./db";
import type { Outcome, Workout } from "./types";

const CURSOR_KEY = "sync.cursor";

type Listener = (state: SyncState) => void;
export interface SyncState {
  pending: number;
  syncing: boolean;
  lastError: string | null;
  lastSyncedAt: number | null;
  failed: { id: string; error: string }[];
}

let state: SyncState = { pending: 0, syncing: false, lastError: null, lastSyncedAt: null, failed: [] };
const listeners = new Set<Listener>();
const outcomeListeners = new Set<(o: Outcome) => void>();

function set(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l(state));
}

export function subscribeSync(fn: Listener) {
  listeners.add(fn);
  fn(state);
  return () => void listeners.delete(fn);
}

/** Fired with the game outcome (XP, PRs, badges) after a successful push. */
export function onOutcome(fn: (o: Outcome) => void) {
  outcomeListeners.add(fn);
  return () => void outcomeListeners.delete(fn);
}

async function refreshPending() {
  const ops = await (await db()).getAll("outbox");
  set({ pending: ops.length, failed: ops.filter((o) => o.error).map((o) => ({ id: o.id, error: o.error! })) });
}

/** Save locally, queue for the server, and try to send straight away. */
export async function saveWorkout(workout: Workout) {
  const now = new Date().toISOString();
  const record: Workout = { ...workout, client_updated_at: now, deleted_at: null, _pending: true, _error: null };
  const d = await db();
  const tx = d.transaction(["workouts", "outbox"], "readwrite");
  await tx.objectStore("workouts").put(record);
  await tx.objectStore("outbox").put({ id: record.id, op: "put", workout: record, client_updated_at: now, attempts: 0 });
  await tx.done;
  notifyWorkoutsChanged();
  await refreshPending();
  schedulePush(0);
  return record;
}

export async function deleteWorkout(id: string) {
  const now = new Date().toISOString();
  const d = await db();
  const existing = await d.get("workouts", id);
  const tx = d.transaction(["workouts", "outbox"], "readwrite");
  if (existing) await tx.objectStore("workouts").put({ ...existing, deleted_at: now, client_updated_at: now, _pending: true });
  await tx.objectStore("outbox").put({ id, op: "delete", client_updated_at: now, attempts: 0 });
  await tx.done;
  notifyWorkoutsChanged();
  await refreshPending();
  schedulePush(0);
}

let pushTimer: ReturnType<typeof setTimeout> | undefined;
export function schedulePush(delay = 400) {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => void push(), delay);
}

function strip(w: Workout) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _pending, _error, seq, local_date, source, deleted_at, id, ...body } = w;
  return body;
}

let pushing = false;
export async function push(): Promise<void> {
  if (pushing || !isAuthenticated() || !navigator.onLine) return;
  pushing = true;
  set({ syncing: true });
  try {
    const d = await db();
    const ops = (await d.getAll("outbox")).filter((o) => !o.error).slice(0, 100);
    if (!ops.length) return;
    const res = await api<{ results: { id: string; ok: boolean; applied?: boolean; workout?: Workout; detail?: string; status?: number }[]; outcome: Outcome | null }>(
      "/workouts/batch",
      {
        method: "POST",
        body: {
          ops: ops.map((o) => ({
            op: o.op,
            id: o.id,
            client_updated_at: o.client_updated_at,
            workout: o.op === "put" && o.workout ? strip(o.workout) : undefined,
          })),
        },
      },
    );
    const byId = new Map(ops.map((o) => [o.id, o]));
    const tx = d.transaction(["workouts", "outbox"], "readwrite");
    for (const r of res.results) {
      const op = byId.get(r.id);
      if (!op) continue;
      // Only clear the queue entry if nothing newer was queued meanwhile.
      const current = (await tx.objectStore("outbox").get(r.id)) as OutboxOp | undefined;
      const superseded = current && current.client_updated_at !== op.client_updated_at;
      if (r.ok) {
        if (!superseded) await tx.objectStore("outbox").delete(r.id);
        if (op.op === "delete") {
          if (!superseded) await tx.objectStore("workouts").delete(r.id);
        } else if (r.workout && !superseded) {
          await tx.objectStore("workouts").put({ ...r.workout, _pending: false });
        }
      } else if (!superseded) {
        // A 4xx will fail the same way forever. Park it with the reason so
        // the person can fix or discard it, instead of retrying silently.
        const error = r.detail ?? "Rejected by the server";
        await tx.objectStore("outbox").put({ ...op, error, attempts: op.attempts + 1 });
        const w = await tx.objectStore("workouts").get(r.id);
        if (w) await tx.objectStore("workouts").put({ ...w, _error: error });
      }
    }
    await tx.done;
    notifyWorkoutsChanged();
    set({ lastError: null, lastSyncedAt: Date.now() });
    if (res.outcome) outcomeListeners.forEach((l) => l(res.outcome!));
    window.dispatchEvent(new Event("ps:synced"));
    if ((await d.count("outbox")) > ops.length) schedulePush(0);
  } catch (err) {
    set({ lastError: err instanceof NetworkError ? null : err instanceof ApiError ? err.message : "Sync failed" });
    if (!(err instanceof ApiError && err.status < 500)) schedulePush(15_000);
  } finally {
    pushing = false;
    set({ syncing: false });
    await refreshPending();
  }
}

/** Retry a parked op after the person edited it, or drop it. */
export async function discardFailed(id: string) {
  const d = await db();
  const op = await d.get("outbox", id);
  await d.delete("outbox", id);
  const w = await d.get("workouts", id);
  // A never-synced workout that the server refused simply goes away.
  if (w && op?.op === "put" && w.seq == null) await d.delete("workouts", id);
  else if (w) await d.put("workouts", { ...w, _pending: false, _error: null });
  notifyWorkoutsChanged();
  await refreshPending();
}

let pulling = false;
export async function pull(): Promise<void> {
  if (pulling || !isAuthenticated() || !navigator.onLine) return;
  pulling = true;
  try {
    let cursor = (await kvGet<number>(CURSOR_KEY)) ?? 0;
    const d = await db();
    for (let page = 0; page < 50; page++) {
      const res = await api<{ workouts: Workout[]; cursor: number; more: boolean }>(`/workouts/changes?since=${cursor}`);
      const tx = d.transaction(["workouts", "outbox"], "readwrite");
      for (const w of res.workouts) {
        // A local edit still waiting to go up wins over what the server has.
        const queued = await tx.objectStore("outbox").get(w.id);
        if (queued && queued.client_updated_at >= w.client_updated_at) continue;
        if (w.deleted_at) await tx.objectStore("workouts").delete(w.id);
        else await tx.objectStore("workouts").put({ ...w, _pending: false });
      }
      await tx.done;
      cursor = res.cursor;
      await kvSet(CURSOR_KEY, cursor);
      if (!res.more) break;
    }
    notifyWorkoutsChanged();
  } catch {
    /* next trigger retries */
  } finally {
    pulling = false;
  }
}

export async function syncNow() {
  await push();
  await pull();
}

let started = false;
/** Wire the triggers once, after sign-in. */
export function startSync() {
  if (started) return;
  started = true;
  void refreshPending();
  void syncNow();
  window.addEventListener("online", () => void syncNow());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void syncNow();
  });
  setInterval(() => void syncNow(), 90_000);
}
