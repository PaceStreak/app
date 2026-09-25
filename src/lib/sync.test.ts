/**
 * The offline outbox, against a real IndexedDB implementation (fake-indexeddb)
 * rather than a mock of one. Only the network layer is faked.
 *
 * The properties that matter, because each one is a way to lose or duplicate
 * a training session:
 *  - a save lands on the device first, whether or not the network works;
 *  - editing offline replaces the queued write instead of queueing twice;
 *  - an edit made while a push is in flight is not dropped when that push
 *    succeeds;
 *  - a rejected write is parked with its reason, not retried forever;
 *  - pulling never overwrites a newer local edit still waiting to go up, and
 *    it applies deletions from other devices.
 */
import * as fakeIndexedDB from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";

const net = vi.hoisted(() => ({
  batch: vi.fn(),
  changes: vi.fn(),
}));

vi.hoisted(() => {
  const target = new EventTarget();
  Object.assign(globalThis, {
    window: Object.assign(target, { localStorage: undefined }),
    document: Object.assign(new EventTarget(), { visibilityState: "visible" }),
  });
  Object.defineProperty(globalThis, "navigator", { value: { onLine: true }, configurable: true });
});

// Installed on globalThis explicitly: fake-indexeddb/auto attaches to `window`
// when one exists, and the stub above creates one.
Object.assign(globalThis, fakeIndexedDB);

vi.mock("./api", () => {
  class ApiError extends Error {
    constructor(public status: number, message: string) {
      super(message);
    }
  }
  class NetworkError extends Error {}
  return {
    ApiError,
    NetworkError,
    isAuthenticated: () => true,
    api: (path: string, opts: { body?: unknown }) =>
      path.startsWith("/workouts/batch") ? net.batch(opts.body) : net.changes(path),
  };
});

import { db, kvSet } from "./db";
import { deleteWorkout, discardFailed, pull, push, saveWorkout, subscribeSync } from "./sync";
import type { Workout } from "./types";

function workout(id: string, extra: Partial<Workout> = {}): Workout {
  return {
    id,
    discipline: "run",
    title: null,
    notes: null,
    started_at: "2026-09-24T07:00:00.000Z",
    local_date: "2026-09-24",
    duration_sec: 1800,
    distance_m: 5000,
    elevation_m: null,
    effort: null,
    feel: null,
    routine_id: null,
    source: "app",
    client_updated_at: "2026-09-24T07:00:00.000Z",
    deleted_at: null,
    sets: [],
    ...extra,
  } as Workout;
}

/** The server accepts everything and echoes it back. */
function acceptAll() {
  net.batch.mockImplementation(async (body: { ops: { id: string; op: string; workout?: Workout }[] }) => ({
    results: body.ops.map((o) => ({ id: o.id, ok: true, workout: o.workout ? { ...o.workout, id: o.id, seq: 1 } : undefined })),
    outcome: null,
  }));
}

async function outbox() {
  return (await db()).getAll("outbox");
}

beforeEach(async () => {
  net.batch.mockReset();
  net.changes.mockReset();
  const d = await db();
  await Promise.all([d.clear("workouts"), d.clear("outbox"), d.clear("kv")]);
});

describe("saving", () => {
  it("lands on the device even when the network is down", async () => {
    net.batch.mockRejectedValue(new TypeError("Failed to fetch"));
    await saveWorkout(workout("a"));
    await push();
    const stored = await (await db()).get("workouts", "a");
    expect(stored?._pending).toBe(true);
    expect(await outbox()).toHaveLength(1);
  });

  it("replaces the queued write when edited again offline", async () => {
    net.batch.mockRejectedValue(new TypeError("offline"));
    await saveWorkout(workout("a", { title: "first" }));
    await saveWorkout(workout("a", { title: "second" }));
    const ops = await outbox();
    expect(ops).toHaveLength(1);
    expect(ops[0].workout?.title).toBe("second");
  });

  it("clears the queue once the server confirms", async () => {
    acceptAll();
    await saveWorkout(workout("a"));
    await push();
    expect(await outbox()).toHaveLength(0);
    expect((await (await db()).get("workouts", "a"))?._pending).toBe(false);
  });
});

describe("an edit made while a push is in flight", () => {
  it("is not dropped when the older push succeeds", async () => {
    let release: () => void = () => undefined;
    net.batch.mockImplementation(
      (body: { ops: { id: string; workout?: Workout }[] }) =>
        new Promise((resolve) => {
          release = () => resolve({ results: body.ops.map((o) => ({ id: o.id, ok: true, workout: o.workout })), outcome: null });
        }),
    );
    await saveWorkout(workout("a", { title: "old" }));
    const inFlight = push();
    await vi.waitFor(() => expect(net.batch).toHaveBeenCalled());
    // A newer edit lands while the first request is still out.
    await new Promise((r) => setTimeout(r, 5));
    await saveWorkout(workout("a", { title: "new" }));
    release();
    await inFlight;
    const ops = await outbox();
    expect(ops).toHaveLength(1);
    expect(ops[0].workout?.title).toBe("new");
  });
});

describe("rejections", () => {
  it("park the write with its reason instead of retrying forever", async () => {
    net.batch.mockResolvedValue({ results: [{ id: "a", ok: false, detail: "Unknown exercise" }], outcome: null });
    const states: { failed: unknown[] }[] = [];
    const stop = subscribeSync((s) => states.push(s));
    await saveWorkout(workout("a"));
    await push();
    stop();
    const [op] = await outbox();
    expect(op.error).toBe("Unknown exercise");
    expect((await (await db()).get("workouts", "a"))?._error).toBe("Unknown exercise");
    expect(states.at(-1)?.failed).toHaveLength(1);

    // A parked write is not sent again.
    net.batch.mockClear();
    await push();
    expect(net.batch).not.toHaveBeenCalled();
  });

  it("discarding a never-synced write removes the local copy", async () => {
    net.batch.mockResolvedValue({ results: [{ id: "a", ok: false, detail: "nope" }], outcome: null });
    await saveWorkout(workout("a"));
    await push();
    await discardFailed("a");
    expect(await (await db()).get("workouts", "a")).toBeUndefined();
    expect(await outbox()).toHaveLength(0);
  });
});

describe("deleting", () => {
  it("queues a delete made offline and removes the row once confirmed", async () => {
    acceptAll();
    await saveWorkout(workout("a"));
    await push();
    // Offline, so the push that deleteWorkout schedules can't race the
    // assertion: the delete has to wait in the outbox.
    (navigator as { onLine: boolean }).onLine = false;
    try {
      await deleteWorkout("a");
      expect((await outbox())[0].op).toBe("delete");
    } finally {
      (navigator as { onLine: boolean }).onLine = true;
    }
    await push();
    expect(await (await db()).get("workouts", "a")).toBeUndefined();
    expect(await outbox()).toHaveLength(0);
  });
});

describe("pulling", () => {
  it("applies other devices' edits and deletions, and advances the cursor", async () => {
    const d = await db();
    await d.put("workouts", workout("gone"));
    net.changes.mockResolvedValue({
      workouts: [workout("new"), workout("gone", { deleted_at: "2026-09-24T09:00:00Z" })],
      cursor: 42,
      more: false,
    });
    await pull();
    expect(await d.get("workouts", "new")).toBeDefined();
    expect(await d.get("workouts", "gone")).toBeUndefined();
    expect(await d.get("kv", "sync.cursor")).toBe(42);
  });

  it("never overwrites a newer local edit that is still queued", async () => {
    net.batch.mockRejectedValue(new TypeError("offline"));
    await saveWorkout(workout("a", { title: "mine, newer" }));
    await kvSet("sync.cursor", 0);
    net.changes.mockResolvedValue({
      workouts: [workout("a", { title: "theirs, older", client_updated_at: "2000-01-01T00:00:00Z" })],
      cursor: 1,
      more: false,
    });
    await pull();
    expect((await (await db()).get("workouts", "a"))?.title).toBe("mine, newer");
  });
});
