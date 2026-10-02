import { describe, expect, it } from "vitest";
import { adjustRoutineItems, fuzzyMatch, localWeek, muscleRecovery, parseShorthand, loadedTotal, planMatches, platesFor, substitutes, suggestNext, volumeNudge } from "./training";
import type { Exercise, Workout } from "./types";

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
  it("uses the routine's own step", () => {
    const s = suggestNext([{ weight_kg: 140, reps: 5, rpe: 8 }], { repsMax: 5, stepKg: 5, unit: "kg" });
    expect(s?.weight_kg).toBe(145);
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

describe("loadedTotal", () => {
  it("adds both sides to the bar", () => {
    expect(loadedTotal(20, [20, 1.25])).toBe(62.5);
    expect(loadedTotal(45, [45, 45])).toBe(225);
    expect(loadedTotal(7, [])).toBe(7);
  });
  it("round-trips with platesFor", () => {
    const { plates } = platesFor(97.5, 20, [25, 20, 15, 10, 5, 2.5, 1.25]);
    expect(loadedTotal(20, plates)).toBe(97.5);
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

describe("stall resets", () => {
  it("steps back 10% after two sessions short of the range", () => {
    const s = suggestNext([{ weight_kg: 100, reps: 5, rpe: null }], { repsMin: 6, repsMax: 8, unit: "kg", earlier: [{ weight_kg: 100, reps: 5 }] });
    expect(s).toMatchObject({ weight_kg: 90, reps: 8, reset: true });
  });
  it("steps back after three flat sessions at one weight", () => {
    const s = suggestNext([{ weight_kg: 100, reps: 6, rpe: null }], { unit: "kg", earlier: [{ weight_kg: 100, reps: 6 }, { weight_kg: 100, reps: 6 }] });
    expect(s?.reset).toBe(true);
  });
  it("keeps progressing while reps still climb", () => {
    const s = suggestNext([{ weight_kg: 100, reps: 7, rpe: null }], { repsMax: 8, unit: "kg", earlier: [{ weight_kg: 100, reps: 6 }, { weight_kg: 100, reps: 5 }] });
    expect(s).toMatchObject({ weight_kg: 100, reps: 8 });
    expect(s?.reset).toBeUndefined();
  });
});

describe("parseShorthand", () => {
  it("reads the common forms", () => {
    expect(parseShorthand("100x5")).toEqual({ weight: 100, reps: 5, sets: 1 });
    expect(parseShorthand("100 x 5 x 3")).toEqual({ weight: 100, reps: 5, sets: 3 });
    expect(parseShorthand("3x5@102.5")).toEqual({ weight: 102.5, reps: 5, sets: 3 });
    expect(parseShorthand("8@60")).toEqual({ weight: 60, reps: 8, sets: 1 });
    expect(parseShorthand("62,5×8")).toEqual({ weight: 62.5, reps: 8, sets: 1 });
    expect(parseShorthand("12")).toEqual({ weight: null, reps: 12, sets: 1 });
  });
  it("rejects nonsense", () => {
    for (const t of ["", "abc", "100x", "x5", "100x0", "100x5x50", "5000x5"]) expect(parseShorthand(t)).toBeNull();
  });
});

describe("fuzzyMatch", () => {
  it("forgives one typo in longer words, not in short ones", () => {
    expect(fuzzyMatch("benhc prss", "Bench press")).toBe(true);
    expect(fuzzyMatch("dedlift", "Deadlift")).toBe(true);
    expect(fuzzyMatch("squat", "Back squat")).toBe(true);
    expect(fuzzyMatch("raw", "Barbell row")).toBe(false);
    expect(fuzzyMatch("curl", "Bench press")).toBe(false);
  });
});

describe("muscleRecovery", () => {
  it("reports days since and sets this week per primary muscle", () => {
    const ex = new Map([["back-squat", { primary: ["quads"] } as Exercise]]);
    const rows = [
      { id: "a", local_date: "2026-09-24", deleted_at: null, sets: [{ exercise_id: "back-squat", completed: true, kind: "work" }, { exercise_id: "back-squat", completed: true, kind: "warmup" }] },
      { id: "b", local_date: "2026-09-10", deleted_at: null, sets: [{ exercise_id: "back-squat", completed: true, kind: "work" }] },
    ] as unknown as Workout[];
    expect(muscleRecovery(rows, ex, "2026-09-26").get("quads")).toEqual({ daysSince: 2, sets7: 1 });
  });
});

describe("volumeNudge and adjustRoutineItems", () => {
  const session = (id: string, soreness: number | null, pump: number | null) =>
    ({ id, deleted_at: null, soreness, pump, sets: [{ exercise_id: "back-squat", completed: true }] }) as unknown as Workout;
  it("needs two check-ins that agree", () => {
    expect(volumeNudge([session("a", 3, 0), session("b", 3, 1)], "back-squat")).toBe("fewer");
    expect(volumeNudge([session("a", 0, 2), session("b", 0, 2)], "back-squat")).toBe("more");
    expect(volumeNudge([session("a", 3, 0), session("b", 1, 1)], "back-squat")).toBeNull();
    expect(volumeNudge([session("a", 3, 0), session("b", null, null)], "back-squat")).toBeNull();
    expect(volumeNudge([session("a", 3, 0)], "back-squat")).toBeNull();
  });
  it("halves sets, lightens load and caps effort; short keeps the first half", () => {
    const items = [
      { sets: 4, weight_kg: 100, target_rpe: 9 },
      { sets: 3, weight_kg: null, target_rpe: null },
      { sets: 2, weight_kg: 20, target_rpe: 6 },
    ];
    expect(adjustRoutineItems(items, { easy: true })).toEqual([
      { sets: 2, weight_kg: 90, target_rpe: 7 },
      { sets: 2, weight_kg: null, target_rpe: 7 },
      { sets: 1, weight_kg: 18, target_rpe: 6 },
    ]);
    expect(adjustRoutineItems(items, { short: true })).toHaveLength(2);
  });
});


describe("substitutes", () => {
  const ex = (id: string, equipment: string, primary: string[], pattern = "pull_v") =>
    ({ id, name: id.replace(/-/g, " "), pattern, equipment, primary, secondary: [], load_type: "weight", rest_sec: 90, cue: "", unilateral: false, aliases: [], custom: false }) as Exercise;
  const lat = ex("lat-pulldown", "cable", ["lats"]);
  const all = [lat, ex("v-handle-pulldown", "cable", ["lats"]), ex("pull-up", "bodyweight", ["lats"]), ex("machine-pulldown", "machine", ["lats"]), ex("barbell-row", "barbell", ["lats"], "pull_h"), ex("curl", "cable", ["biceps"])];

  it("keeps the pattern and a shared muscle, other equipment first", () => {
    const ids = substitutes(lat, all).map((e) => e.id);
    expect(ids).not.toContain("lat-pulldown");
    expect(ids).not.toContain("barbell-row");
    expect(ids).not.toContain("curl");
    expect(ids.indexOf("v-handle-pulldown")).toBe(ids.length - 1);
  });

  it("respects the gym's equipment", () => {
    expect(substitutes(lat, all, new Set(["cable"])).map((e) => e.id)).toEqual(["v-handle-pulldown"]);
  });
});


describe("planMatches", () => {
  const fiveByFive = { disciplines: ["strength"], equipment: ["barbell"] };
  const run = { disciplines: ["run"], equipment: [] };
  const hybrid = { disciplines: ["run", "strength"], equipment: ["barbell", "dumbbell"] };
  it("sorts plans into strength, endurance and no-equipment", () => {
    expect(planMatches(fiveByFive, "strength", null)).toBe(true);
    expect(planMatches(run, "strength", null)).toBe(false);
    expect(planMatches(hybrid, "endurance", null)).toBe(true);
    expect(planMatches(run, "none", null)).toBe(true);
    expect(planMatches(fiveByFive, "none", null)).toBe(false);
  });
  it("fits a gym only when every kind of equipment is there", () => {
    expect(planMatches(hybrid, "gym", ["barbell"])).toBe(false);
    expect(planMatches(hybrid, "gym", ["barbell", "dumbbell", "cable"])).toBe(true);
    expect(planMatches(run, "gym", ["dumbbell"])).toBe(true);
    expect(planMatches(hybrid, "gym", null)).toBe(true);
  });
});
