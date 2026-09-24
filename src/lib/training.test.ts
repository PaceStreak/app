import { describe, expect, it } from "vitest";
import { localWeek, platesFor, suggestNext } from "./training";
import type { Workout } from "./types";

const w = (date: string, discipline = "run") => ({ id: date + discipline, local_date: date, discipline, deleted_at: null }) as Workout;

describe("localWeek", () => {
  it("counts distinct days in the chain's disciplines, this week only", () => {
    const rows = [w("2026-09-21"), w("2026-09-21", "strength"), w("2026-09-23"), w("2026-09-18")];
    const all = localWeek(rows, { disciplines: [] }, "2026-09-24", 0);
    expect(all.count).toBe(2);
    expect(all.dots.map((d) => d.trained)).toEqual([true, false, true, false, false, false, false]);
    const lifting = localWeek(rows, { disciplines: ["strength"] }, "2026-09-24", 0);
    expect(lifting.count).toBe(1);
  });
});

describe("suggestNext", () => {
  it("adds load when every set hit the top of the range", () => {
    const s = suggestNext(
      [
        { weight_kg: 100, reps: 8, rpe: null },
        { weight_kg: 100, reps: 8, rpe: 8 },
      ],
      { repsMax: 8, unit: "kg" },
    );
    expect(s?.weight_kg).toBe(102.5);
  });
  it("chases reps otherwise", () => {
    const s = suggestNext([{ weight_kg: 100, reps: 6, rpe: null }], { repsMax: 8, unit: "kg" });
    expect(s).toMatchObject({ weight_kg: 100, reps: 7 });
  });
  it("auto-regulates from RPE", () => {
    const s = suggestNext([{ weight_kg: 100, reps: 5, rpe: 6 }], { targetRpe: 8, unit: "kg" });
    expect(s?.weight_kg).toBeCloseTo(106.25);
  });
});

describe("platesFor", () => {
  it("loads greedily per side", () => {
    expect(platesFor(100, 20, [25, 20, 15, 10, 5, 2.5, 1.25])).toEqual({ plates: [25, 15], remainder: 0 });
    expect(platesFor(101, 20, [25, 20, 15, 10, 5, 2.5, 1.25]).remainder).toBe(1);
  });
});

import { parseDuration } from "./units";
describe("parseDuration", () => {
  it("reads sessions as minutes or h:mm, holds as m:ss", () => {
    expect(parseDuration("45")).toBe(2700);
    expect(parseDuration("1:30")).toBe(5400);
    expect(parseDuration("1:30", "ms")).toBe(90);
    expect(parseDuration("1:05:00")).toBe(3900);
  });
});
