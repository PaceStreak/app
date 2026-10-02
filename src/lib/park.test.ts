/**
 * Signing out, or someone else signing in, must never delete a session that
 * hasn't reached the server. It is parked under its owner and comes back
 * when they sign in again. Against a real IndexedDB (fake-indexeddb).
 */
import * as fakeIndexedDB from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";

Object.assign(globalThis, fakeIndexedDB);

import { db, park, unpark, unsentCount, wipe, type OutboxOp } from "./db";
import type { Workout } from "./types";

const op = (id: string, title = "x"): OutboxOp => ({
  id,
  op: "put",
  workout: { id, title, local_date: "2026-10-02" } as unknown as Workout,
  client_updated_at: new Date().toISOString(),
  attempts: 0,
});

async function queue(...ops: OutboxOp[]) {
  const d = await db();
  for (const o of ops) await d.put("outbox", o);
}

beforeEach(async () => {
  const d = await db();
  await Promise.all(["workouts", "outbox", "kv", "requests", "photos", "parked"].map((s) => d.clear(s as "kv")));
});

describe("parking unsent writes", () => {
  it("a sign-out keeps the owner's unsent session and gives it back", async () => {
    await queue(op("w1"));
    await (await db()).put("requests", { path: "/weigh-ins/a", method: "PUT", body: { kg: 80 }, queued_at: "now" });
    expect(await unsentCount()).toBe(2);

    await wipe("alice");
    expect(await unsentCount()).toBe(0);

    expect(await unpark("bob")).toBe(0);
    expect(await unsentCount()).toBe(0);

    expect(await unpark("alice")).toBe(2);
    const d = await db();
    expect((await d.getAll("outbox")).map((o) => o.id)).toEqual(["w1"]);
    expect((await d.get("workouts", "w1"))?._pending).toBe(true);
    expect(await d.count("parked")).toBe(0);
  });

  it("parking twice merges, newest edit wins", async () => {
    await queue(op("w1", "old"), op("w2"));
    await park("alice");
    await (await db()).clear("outbox");
    await queue(op("w1", "new"));
    await park("alice");
    await unpark("alice");
    const rows = await (await db()).getAll("outbox");
    expect(rows.map((o) => [o.id, o.workout?.title])).toEqual([
      ["w1", "new"],
      ["w2", "x"],
    ]);
  });

  it("a wipe with no known owner parks nothing, and nothing is parked when empty", async () => {
    await park("alice");
    expect(await (await db()).count("parked")).toBe(0);
    await queue(op("w1"));
    await wipe(undefined);
    expect(await (await db()).count("parked")).toBe(0);
  });
});
