import { describe, expect, it } from "vitest";
import { isDone, orderForToday, partOfDay, progressText, skillProjection, stepFor } from "./habits";
import type { Habit } from "./types";

const h = (over: Partial<Habit>) => ({ id: "x", kind: "check", daily_goal: null, unit: null, time_of_day: "anytime", position: 0, today: { amount: 0, done: false }, ...over }) as Habit;

describe("habit helpers", () => {
  it("knows when a day is done, per kind", () => {
    expect(isDone(h({ kind: "check" }), 1)).toBe(true);
    expect(isDone(h({ kind: "count", daily_goal: 6 }), 5)).toBe(false);
    expect(isDone(h({ kind: "count", daily_goal: 6 }), 6)).toBe(true);
    expect(isDone(h({ kind: "quit" }), 0)).toBe(true);
    expect(isDone(h({ kind: "quit" }), 1)).toBe(false);
  });

  it("formats progress and picks a sensible step", () => {
    expect(progressText(h({ kind: "count", daily_goal: 6, unit: "glasses" }), 3)).toBe("3 / 6 glasses");
    expect(progressText(h({ kind: "duration", daily_goal: 20 }), 12.5)).toBe("12.5 / 20 min");
    expect(progressText(h({ kind: "check" }), 1)).toBeNull();
    expect(stepFor(h({ kind: "duration", daily_goal: 60 }))).toBe(10);
    expect(stepFor(h({ kind: "count", daily_goal: 300 }))).toBe(10);
    expect(stepFor(h({ kind: "count", daily_goal: 6 }))).toBe(1);
  });

  it("orders today's list by the part of the day, unfinished first", () => {
    const list = [
      h({ id: "eve", time_of_day: "evening" }),
      h({ id: "done", time_of_day: "morning", today: { amount: 1, done: true } }),
      h({ id: "any", time_of_day: "anytime" }),
      h({ id: "morn", time_of_day: "morning" }),
    ];
    expect(orderForToday(list, partOfDay(8)).map((x) => x.id)).toEqual(["morn", "done", "any", "eve"]);
  });

  it("projects a skill goal from the last four weeks", () => {
    const days = Array.from({ length: 28 }, (_, i) => ({ date: `2026-09-${String(i + 1).padStart(2, "0")}`, amount: 30 }));
    const p = skillProjection(840, 6000, days, "2026-09-28")!;
    expect(p.pct).toBe(14);
    expect(p.perWeek).toBe(210);
    expect(p.eta).toBe("2027-03-19"); // 5160 min left at 30 a day
    expect(skillProjection(100, null, days, "2026-09-28")).toBeNull();
    expect(skillProjection(0, 100, [], "2026-09-28")!.eta).toBeNull();
  });
});
