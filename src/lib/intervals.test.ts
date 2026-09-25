import { describe, expect, it } from "vitest";
import { buildPlan, positionAt, PRESETS, totalSeconds } from "./intervals";

describe("intervals", () => {
  it("has no rest after the last round", () => {
    const plan = buildPlan({ ...PRESETS.tabata, prepare: 0 });
    expect(plan.filter((p) => p.kind === "work")).toHaveLength(8);
    expect(plan.filter((p) => p.kind === "rest")).toHaveLength(7);
    expect(totalSeconds(plan)).toBe(8 * 20 + 7 * 10);
  });

  it("finds the phase from elapsed time alone", () => {
    const plan = buildPlan({ mode: "intervals", work: 30, rest: 15, rounds: 3, prepare: 10 });
    expect(positionAt(plan, 0)).toMatchObject({ kind: "prepare", round: 0 });
    expect(positionAt(plan, 12_000)).toMatchObject({ kind: "work", round: 1 });
    expect(positionAt(plan, 12_000).remaining).toBeCloseTo(28);
    expect(positionAt(plan, 41_000)).toMatchObject({ kind: "rest", round: 1 });
    // A phone locked for a minute comes back to the right place.
    expect(positionAt(plan, 101_000)).toMatchObject({ kind: "work", round: 3 });
    expect(positionAt(plan, 10_000_000).kind).toBe("done");
  });

  it("models EMOM as a minute per round", () => {
    const plan = buildPlan({ ...PRESETS.emom, rounds: 5, prepare: 0 });
    expect(plan).toHaveLength(5);
    expect(totalSeconds(plan)).toBe(300);
  });

  it("clamps silly input", () => {
    const plan = buildPlan({ mode: "intervals", work: 0, rest: -5, rounds: 500, prepare: 0 });
    expect(plan.every((p) => p.seconds >= 1)).toBe(true);
    expect(plan.filter((p) => p.kind === "work")).toHaveLength(99);
  });
});
