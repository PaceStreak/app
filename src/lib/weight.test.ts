import { describe, expect, it } from "vitest";
import { addDays } from "./dates";
import type { WeighIn, WeighInMoment } from "./types";
import { changeOver, dailySeries, daySwing, goalView, guessMoment, pctChange, signed, weeklyRate } from "./weight";

let n = 0;
const w = (date: string, weight_kg: number, moment: WeighInMoment = "waking"): WeighIn => ({
  id: String(n++),
  weighed_at: `${date}T07:00:00Z`,
  date,
  moment,
  weight_kg,
  note: null,
});

describe("dailySeries", () => {
  it("averages a day's readings and can keep only one moment", () => {
    const data = [w("2026-09-01", 80, "waking"), w("2026-09-01", 82, "bedtime")];
    expect(dailySeries(data).map((p) => p.kg)).toEqual([81]);
    expect(dailySeries(data, "waking").map((p) => p.kg)).toEqual([80]);
    expect(dailySeries(data, "post_workout")).toEqual([]);
  });

  it("smooths over the trailing seven calendar days, skipping gaps", () => {
    const data = [w("2026-09-01", 80), w("2026-09-05", 82), w("2026-09-09", 84)];
    // 09-09's window starts 09-03, so it holds 82 and 84 only.
    expect(dailySeries(data).map((p) => p.avg)).toEqual([80, 81, 83]);
  });
});

describe("changeOver", () => {
  // Forty days losing 0.1 kg a day.
  const daily = Array.from({ length: 40 }, (_, i) => w(addDays("2026-08-01", i), 100 - i * 0.1));

  it("reports kilograms and percent against the smoothed weight", () => {
    const c = changeOver(dailySeries(daily), 30)!;
    expect(c.kg).toBeCloseTo(-3, 1);
    expect(c.pct).toBeLessThan(0);
  });

  it("refuses a span the history does not cover", () => {
    expect(changeOver(dailySeries(daily.slice(0, 9)), 30)).toBeNull();
    expect(changeOver(dailySeries(daily.slice(0, 1)), 7)).toBeNull();
  });

  it("gives a weekly weigher a 7-day figure", () => {
    const c = changeOver(dailySeries([w("2026-09-01", 80), w("2026-09-08", 79)]), 7)!;
    expect(c.kg).toBe(-1);
  });
});

describe("helpers", () => {
  it("guesses the moment from the hour", () => {
    expect(guessMoment(6)).toBe("waking");
    expect(guessMoment(14)).toBe("other");
    expect(guessMoment(23)).toBe("bedtime");
    expect(guessMoment(1)).toBe("bedtime");
  });

  it("measures the swing within a day", () => {
    const data = [w("2026-09-01", 80), w("2026-09-01", 81.4, "bedtime"), w("2026-09-02", 80)];
    expect(daySwing(data, "2026-09-01")).toBe(1.4);
    expect(daySwing(data, "2026-09-02")).toBeNull();
  });

  it("formats percentages and signs", () => {
    expect(pctChange(100, 112.5)).toBe(12.5);
    expect(pctChange(undefined, 5)).toBeNull();
    expect(signed(1.26)).toBe("+1.3");
    expect(signed(-0.5)).toBe("−0.5");
  });
});

describe("goal and projection", () => {
  // Losing 0.1 kg a day for 40 days from 100 kg.
  const series = dailySeries(Array.from({ length: 40 }, (_, i) => w(addDays("2026-08-01", i), 100 - i * 0.1)));
  const today = "2026-09-09";

  it("measures the weekly rate and refuses thin data", () => {
    expect(weeklyRate(series)).toBeCloseTo(-0.7, 2);
    expect(weeklyRate(series.slice(0, 5))).toBeNull();
  });

  it("tracks milestones and projects a date", () => {
    const g = goalView(series, { target_kg: 90, start_kg: 100, milestone_kg: 2 }, today)!;
    expect(g.milestonesTotal).toBe(5);
    expect(g.milestonesPassed).toBe(1); // about 96.3 now: past 98, not 96
    expect(g.nextMilestone).toBe(96);
    expect(g.eta).not.toBeNull();
    expect(g.eta! > today).toBe(true);
  });

  it("gives no date when the trend runs the other way, and works for gaining", () => {
    const g = goalView(series, { target_kg: 105, start_kg: 100, milestone_kg: 1 }, today)!;
    expect(g.eta).toBeNull();
    expect(g.progress).toBe(0);
    expect(g.reached).toBe(false);
  });
});
