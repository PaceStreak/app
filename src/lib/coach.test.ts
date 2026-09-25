import { describe, expect, it } from "vitest";
import { buildCards, type CoachContext } from "./coach";
import type { Chain, Me, Stats } from "./types";

const week = (week_start: string, status: Chain["weeks"][number]["status"]) => ({ week_start, days: status === "kept" ? 3 : 0, target: 3, status, score: status === "kept" ? 100 : 0 });

function ctx(chain: Partial<Chain>, extra: Partial<CoachContext> = {}): CoachContext {
  const main = { id: "c", name: "Main", disciplines: [], target: 3, current: 0, longest: 6, freezes_available: 0, this_week_days: 0, this_week_target: 3, days_left: 5, needed: 3, at_risk: false, will_freeze: false, repairable_week: null, run_started: null, consistency: 70, consistency_12: 70, consistency_52: 70, paused_now: false, requirements: [], weeks: [], ...chain } as Chain;
  return {
    me: { user: { email: "a@b.c", is_verified: true }, profile: { week_starts_on: 0, timezone: "UTC", deletion_scheduled_at: null } } as unknown as Me,
    stats: { chains: [main], totals: { sessions: 30 }, last_active: "2026-09-20", pauses: [], paused_today: false } as unknown as Stats,
    workouts: [],
    today: "2026-09-23",
    week: { count: 0, trainedToday: false },
    challenges: [],
    failed: 0,
    activeWorkout: null,
    canInstall: false,
    pushOffer: false,
    dismissed: () => false,
    ...extra,
  };
}

describe("comeback card", () => {
  it("offers a gentle restart right after a real miss", () => {
    const cards = buildCards(ctx({ weeks: [week("2026-09-07", "kept"), week("2026-09-14", "missed"), week("2026-09-21", "open")] }));
    expect(cards.some((c) => c.id.startsWith("comeback:"))).toBe(true);
  });

  it("stays quiet when the streak is alive or the best was short", () => {
    const alive = buildCards(ctx({ current: 3, weeks: [week("2026-09-07", "kept"), week("2026-09-14", "kept"), week("2026-09-21", "open")] }));
    const short = buildCards(ctx({ longest: 2, weeks: [week("2026-09-07", "kept"), week("2026-09-14", "missed"), week("2026-09-21", "open")] }));
    expect(alive.some((c) => c.id.startsWith("comeback:"))).toBe(false);
    expect(short.some((c) => c.id.startsWith("comeback:"))).toBe(false);
  });

  it("stays quiet long after the break", () => {
    const old = buildCards(ctx({ weeks: [week("2026-08-10", "kept"), week("2026-08-17", "missed"), week("2026-08-24", "missed"), week("2026-08-31", "missed"), week("2026-09-07", "missed"), week("2026-09-21", "open")] }));
    expect(old.some((c) => c.id.startsWith("comeback:"))).toBe(false);
  });
});

describe("freeze preview", () => {
  it("mentions a spare freeze on the at-risk card", () => {
    const cards = buildCards(ctx({ current: 5, at_risk: true, freezes_available: 1, needed: 2, days_left: 2, this_week_days: 1, weeks: [week("2026-09-14", "kept"), week("2026-09-21", "open")] }, { week: { count: 1, trainedToday: false } }));
    expect(cards.some((c) => /freeze covers the week/.test(c.body))).toBe(true);
  });
});

import { deloadSignal } from "./coach";
import type { Workout } from "./types";

describe("deload signal", () => {
  const rated = (n: number, effort: number | null, feel: number | null) =>
    Array.from({ length: n }, (_, i) => ({ id: `${i}`, local_date: `2026-09-${String(10 + i).padStart(2, "0")}`, effort, feel, deleted_at: null }) as unknown as Workout);
  it("fires after four hard weeks", () => {
    expect(deloadSignal(rated(9, 9, null), "2026-09-23")?.reason).toBe("effort");
  });
  it("fires when sessions keep feeling rough", () => {
    expect(deloadSignal(rated(8, null, 1), "2026-09-23")?.reason).toBe("feel");
  });
  it("needs enough rated sessions", () => {
    expect(deloadSignal(rated(5, 10, 1), "2026-09-23")).toBeNull();
  });
  it("stays quiet at normal effort", () => {
    expect(deloadSignal(rated(12, 6, 4), "2026-09-23")).toBeNull();
  });
});

import { sameClock } from "./coach";

describe("sameClock", () => {
  it("treats legacy aliases as the same place", () => {
    expect(sameClock("Asia/Calcutta", "Asia/Kolkata")).toBe(true);
    expect(sameClock("Europe/Kiev", "Europe/Kyiv")).toBe(true);
  });
  it("tells real moves apart, including daylight saving", () => {
    expect(sameClock("Asia/Kolkata", "Europe/London")).toBe(false);
    // Same offset in winter, different in summer: not the same clock.
    expect(sameClock("Europe/London", "Africa/Abidjan", new Date("2026-01-15T12:00:00Z"))).toBe(false);
  });
  it("never throws on a bad name", () => {
    expect(sameClock("Not/AZone", "Europe/London")).toBe(false);
  });
  it("keeps the travel card quiet for an alias", () => {
    const cards = buildCards(ctx({}, { deviceTimezone: "Asia/Calcutta", me: { ...ctx({}).me, profile: { ...ctx({}).me.profile, timezone: "Asia/Kolkata" } } as Me }));
    expect(cards.some((c) => c.id.startsWith("tz:"))).toBe(false);
  });
});
