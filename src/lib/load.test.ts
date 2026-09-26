import { describe, expect, it } from "vitest";
import { addDays } from "./dates";
import { conflictFor, sessionLoad, trainingLoad } from "./load";
import type { Exercise, Workout } from "./types";

const w = (date: string, minutes: number, effort: number | null, discipline = "run", sets: Workout["sets"] = []) =>
  ({ id: date + discipline + minutes, local_date: date, duration_sec: minutes * 60, effort, discipline, deleted_at: null, sets }) as unknown as Workout;

describe("training load", () => {
  it("scores minutes times effort, with sensible gaps filled", () => {
    expect(sessionLoad({ duration_sec: 3600, effort: 7 })).toBe(420);
    expect(sessionLoad({ duration_sec: null, effort: null })).toBe(150);
  });

  it("flags a spike against the last four weeks, and holds back with thin history", () => {
    const today = "2026-09-28";
    const steady = Array.from({ length: 28 }, (_, i) => i).filter((i) => i % 2 === 0).map((i) => w(addDays(today, -i - 7), 40, 5));
    const calm = trainingLoad([...steady, w(today, 40, 5), w(addDays(today, -2), 40, 5)], today);
    expect(calm.state).toBe("easing");
    const hard = Array.from({ length: 7 }, (_, i) => w(addDays(today, -i), 60, 8));
    expect(trainingLoad([...steady, ...hard], today).state).toBe("spike");
    expect(trainingLoad(hard, today).state).toBe("new");
    expect(trainingLoad(hard, today).weeks).toHaveLength(12);
  });
});

describe("conflicts", () => {
  const ex = new Map([["back-squat", { primary: ["quads", "glutes"] } as Exercise]]);
  const squat = Array.from({ length: 6 }, (_, i) => ({ exercise_id: "back-squat", completed: true, kind: "work", set_index: i })) as unknown as Workout["sets"];

  it("says heavy legs then a run, and a hard run then legs", () => {
    const today = "2026-09-28";
    expect(conflictFor([w("2026-09-27", 60, 7, "strength", squat)], ex, today, { discipline: "run" })?.kind).toBe("legs-then-hard-cardio");
    expect(conflictFor([w("2026-09-27", 50, 8)], ex, today, { discipline: "strength", legs: true })?.kind).toBe("hard-cardio-then-legs");
  });
  it("stays quiet for easy days, walks and upper-body plans", () => {
    const today = "2026-09-28";
    expect(conflictFor([w("2026-09-27", 30, 4)], ex, today, { discipline: "strength", legs: true })).toBeNull();
    expect(conflictFor([w("2026-09-27", 60, 7, "strength", squat)], ex, today, { discipline: "walk" })).toBeNull();
    expect(conflictFor([w("2026-09-27", 50, 8)], ex, today, { discipline: "strength", legs: false })).toBeNull();
    expect(conflictFor([], ex, today, null)).toBeNull();
  });
});
