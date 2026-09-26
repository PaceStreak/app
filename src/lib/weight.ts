import { addDays } from "./dates";
import type { WeighIn, WeighInMoment } from "./types";

export const MOMENTS: { value: WeighInMoment; label: string; short: string }[] = [
  { value: "waking", label: "After waking", short: "Waking" },
  { value: "pre_workout", label: "Before training", short: "Pre" },
  { value: "post_workout", label: "After training", short: "Post" },
  { value: "bedtime", label: "Before bed", short: "Bed" },
  { value: "other", label: "Other", short: "Other" },
];

export const momentLabel = (m: WeighInMoment) => MOMENTS.find((x) => x.value === m)?.label ?? m;

/** A sensible default for the moment picker, from the local hour. */
export function guessMoment(hour: number): WeighInMoment {
  if (hour >= 4 && hour < 10) return "waking";
  if (hour >= 21 || hour < 4) return "bedtime";
  return "other";
}

export interface DayPoint {
  date: string;
  kg: number;
  /** Trailing 7-day mean of the days that have a reading. */
  avg: number;
}

/**
 * One point per day: the mean of that day's weigh-ins, optionally only those
 * from one moment. Weight moves a kilo or more within a day, so comparing a
 * morning reading with an evening one is mostly noise; filtering by moment,
 * and smoothing over a week, is what makes a trend readable.
 */
export function dailySeries(weighIns: WeighIn[], moment: WeighInMoment | "all" = "all"): DayPoint[] {
  const byDay = new Map<string, number[]>();
  for (const w of weighIns) {
    if (moment !== "all" && w.moment !== moment) continue;
    const list = byDay.get(w.date) ?? [];
    list.push(w.weight_kg);
    byDay.set(w.date, list);
  }
  const days = [...byDay.keys()].sort();
  const kgs = days.map((d) => mean(byDay.get(d)!));
  return days.map((date, i) => {
    const from = addDays(date, -6);
    const window: number[] = [];
    for (let j = i; j >= 0 && days[j] >= from; j--) window.push(kgs[j]);
    return { date, kg: round2(kgs[i]), avg: round2(mean(window)) };
  });
}

export interface Change {
  kg: number;
  pct: number;
  since: string;
}

/**
 * The change in the smoothed weight over the last `days`, measured against
 * the latest point on or before the start of that span. Null when the history
 * doesn't reach back that far - a "30-day change" over nine days of data would
 * be a false number.
 */
export function changeOver(series: DayPoint[], days: number): Change | null {
  if (series.length < 2) return null;
  const last = series[series.length - 1];
  const target = addDays(last.date, -days);
  let base: DayPoint | undefined;
  for (const p of series) {
    if (p.date <= target) base = p;
    else break;
  }
  // Allow a little slack so a weekly weigher still gets a 7-day figure.
  if (!base || base.date < addDays(target, -Math.max(3, Math.round(days / 4)))) return null;
  const kg = last.avg - base.avg;
  return { kg: round2(kg), pct: round2((kg / base.avg) * 100), since: base.date };
}

/** Lightest to heaviest reading within one day, if there are several. */
export function daySwing(weighIns: WeighIn[], date: string): number | null {
  const kgs = weighIns.filter((w) => w.date === date).map((w) => w.weight_kg);
  return kgs.length > 1 ? round2(Math.max(...kgs) - Math.min(...kgs)) : null;
}

/** Percentage change from the first value to the last, or null. */
export function pctChange(first: number | undefined, last: number | undefined): number | null {
  if (first == null || last == null || first <= 0) return null;
  return round2(((last - first) / first) * 100);
}

export function signed(n: number, digits = 1): string {
  const s = Math.abs(n).toFixed(digits);
  return n > 0 ? `+${s}` : n < 0 ? `−${s}` : s;
}

/**
 * Kilograms per week from a least-squares line through the last four weeks
 * of daily readings. Needs at least eight days spread over two weeks; less
 * than that is noise with a slope drawn on it.
 */
export function weeklyRate(series: DayPoint[]): number | null {
  if (!series.length) return null;
  const last = series[series.length - 1].date;
  const pts = series.filter((p) => p.date > addDays(last, -28));
  if (pts.length < 8) return null;
  const t0 = Date.parse(`${pts[0].date}T00:00:00Z`);
  const xs = pts.map((p) => (Date.parse(`${p.date}T00:00:00Z`) - t0) / 86_400_000);
  if (xs[xs.length - 1] < 14) return null;
  const mx = mean(xs);
  const my = mean(pts.map((p) => p.kg));
  let num = 0;
  let den = 0;
  pts.forEach((p, i) => {
    num += (xs[i] - mx) * (p.kg - my);
    den += (xs[i] - mx) ** 2;
  });
  return den ? round2((num / den) * 7) : null;
}

export interface GoalView {
  current: number;
  /** 0-1 from where the goal started to the target. */
  progress: number;
  reached: boolean;
  /** Milestones passed, and the next one's weight. */
  milestonesPassed: number;
  milestonesTotal: number;
  nextMilestone: number | null;
  /** When the trend reaches the target at the current rate; null if it isn't heading there. */
  eta: string | null;
  rate: number | null;
}

export function goalView(series: DayPoint[], goal: { target_kg: number; start_kg: number; milestone_kg: number }, today: string): GoalView | null {
  if (!series.length) return null;
  const current = series[series.length - 1].avg;
  const span = goal.target_kg - goal.start_kg;
  const dir = Math.sign(span) || 1;
  const moved = (current - goal.start_kg) * dir;
  const total = Math.abs(span);
  const reached = total === 0 || moved >= total - 0.05;
  const step = goal.milestone_kg;
  const milestonesTotal = Math.max(1, Math.ceil(total / step - 1e-9));
  const milestonesPassed = Math.max(0, Math.min(milestonesTotal, Math.floor((moved + 1e-9) / step)));
  const nextMilestone = reached ? null : round2(goal.start_kg + dir * Math.min(total, (milestonesPassed + 1) * step));
  const rate = weeklyRate(series);
  let eta: string | null = null;
  if (!reached && rate && Math.sign(rate) === dir && Math.abs(rate) >= 0.05) {
    const weeks = (total - moved) / Math.abs(rate);
    if (weeks <= 104) eta = addDays(today, Math.round(weeks * 7));
  }
  return { current, progress: total ? Math.max(0, Math.min(1, moved / total)) : 1, reached, milestonesPassed, milestonesTotal, nextMilestone, eta, rate };
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const round2 = (n: number) => Math.round(n * 100) / 100;
