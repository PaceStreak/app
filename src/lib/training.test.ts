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

describe("suggestNext without a bar", () => {
  it("asks for one more bodyweight rep", () => {
    expect(suggestNext([{ weight_kg: null, reps: 9, rpe: null }, { weight_kg: null, reps: 7, rpe: null }], { unit: "kg" })).toMatchObject({ reps: 10 });
  });
  it("stops adding reps at the top of the range", () => {
    const s = suggestNext([{ weight_kg: null, reps: 12, rpe: null }], { repsMax: 12, unit: "kg" });
    expect(s?.reps).toBe(12);
    expect(s?.reason).toMatch(/harder variation/);
  });
  it("adds a few seconds to a hold", () => {
    expect(suggestNext([{ weight_kg: null, reps: null, rpe: null, duration_sec: 45 }], { unit: "kg" })?.duration_sec).toBe(50);
    expect(suggestNext([{ weight_kg: null, reps: null, rpe: null, duration_sec: 90 }], { unit: "kg" })?.duration_sec).toBe(100);
  });
  it("ignores warm-ups", () => {
    expect(suggestNext([{ weight_kg: null, reps: 30, rpe: null, kind: "warmup" }], { unit: "kg" })).toBeNull();
  });
});

import { cleanTag, defaultGear, searchWorkouts } from "./training";
import type { Gear } from "./types";

describe("tags and search", () => {
  it("cleans tags the way the API does", () => {
    expect(cleanTag("#Hill Reps")).toBe("hill-reps");
    expect(cleanTag("  With Sam! ")).toBe("with-sam");
    expect(cleanTag("###")).toBe("");
  });

  const base = { deleted_at: null, sets: [] } as unknown as Workout;
  const rows = [
    { ...base, id: "a", discipline: "run", title: "Hill repeats", notes: "legs heavy", tags: ["hills", "with-sam"], local_date: "2026-09-20" },
    { ...base, id: "b", discipline: "strength", title: null, notes: null, tags: [], local_date: "2026-09-21", sets: [{ exercise_id: "back-squat" }] },
    { ...base, id: "c", discipline: "run", title: "Easy", notes: "sam came too", tags: [], local_date: "2026-09-22" },
  ] as Workout[];
  const names = (id: string) => ({ "back-squat": "Back squat" })[id];
  const disc = (id: string) => ({ run: "Run", strength: "Strength" })[id];

  it("needs every word to match somewhere", () => {
    expect(searchWorkouts(rows, "hill sam", names, disc).map((w) => w.id)).toEqual(["a"]);
    expect(searchWorkouts(rows, "sam", names, disc).map((w) => w.id)).toEqual(["a", "c"]);
  });
  it("finds exercises and disciplines by name", () => {
    expect(searchWorkouts(rows, "squat", names, disc).map((w) => w.id)).toEqual(["b"]);
    expect(searchWorkouts(rows, "strength", names, disc).map((w) => w.id)).toEqual(["b"]);
  });
  it("treats #word as a tag prefix only", () => {
    expect(searchWorkouts(rows, "#hil", names, disc).map((w) => w.id)).toEqual(["a"]);
    expect(searchWorkouts(rows, "#sam", names, disc)).toEqual([]);
  });
  it("picks the default gear for a discipline, never a retired one", () => {
    const gear = [
      { id: "old", retired: true, default_for: ["run"] },
      { id: "new", retired: false, default_for: ["run"] },
    ] as Gear[];
    expect(defaultGear(gear, "run")).toBe("new");
    expect(defaultGear(gear, "ride")).toBeNull();
  });
});

import { warmupSets } from "./training";

describe("warmupSets", () => {
  it("ramps from the bar in plate-friendly steps", () => {
    expect(warmupSets(100, "kg")).toEqual([
      { weight_kg: 20, reps: 10 },
      { weight_kg: 40, reps: 8 },
      { weight_kg: 60, reps: 5 },
      { weight_kg: 80, reps: 3 },
    ]);
  });
  it("drops steps that collapse onto the bar", () => {
    expect(warmupSets(40, "kg").map((s) => s.weight_kg)).toEqual([20, 25, 32.5]);
  });
  it("offers nothing for the empty bar or lighter", () => {
    expect(warmupSets(20, "kg")).toEqual([]);
  });
  it("rounds to 5 lb in pounds", () => {
    const lb = warmupSets(102.058, "lb").map((s) => Math.round(s.weight_kg / 0.45359237));
    expect(lb).toEqual([45, 90, 135, 180]);
  });
});
