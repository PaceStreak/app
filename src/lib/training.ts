import { addDays, localDateOf, weekStart } from "./dates";
import { e1rm, fromKg, toKg, type WeightUnit } from "./units";
import type { Chain, Exercise, Workout, WorkoutSet } from "./types";

export const FEEL = [
  { value: 1, label: "Rough" },
  { value: 2, label: "Flat" },
  { value: 3, label: "Fine" },
  { value: 4, label: "Good" },
  { value: 5, label: "Great" },
] as const;

export const EFFORT = [
  { value: 3, label: "Easy" },
  { value: 5, label: "Steady" },
  { value: 7, label: "Hard" },
  { value: 9, label: "All out" },
] as const;

export function blankWorkout(id: string, discipline: string, startedAt = new Date()): Workout {
  return {
    id,
    discipline,
    title: null,
    notes: null,
    started_at: startedAt.toISOString(),
    local_date: localDateOf(startedAt),
    duration_sec: null,
    distance_m: null,
    elevation_m: null,
    effort: null,
    feel: null,
    routine_id: null,
    source: "app",
    client_updated_at: new Date().toISOString(),
    deleted_at: null,
    sets: [],
  };
}

/** Days trained this week that count for a chain, from what is on the device.
 * The server's stats say the same thing a moment later; this is what makes
 * the dots fill the instant you log, even with no signal. */
export function localWeek(workouts: Workout[], chain: Pick<Chain, "disciplines"> | null, today: string, startsOn: number) {
  const start = weekStart(today, startsOn);
  const allowed = new Set(chain?.disciplines ?? []);
  const days = new Set<string>();
  for (const w of workouts) {
    if (w.deleted_at || w.local_date < start || w.local_date > today) continue;
    if (allowed.size && !allowed.has(w.discipline)) continue;
    days.add(w.local_date);
  }
  const dots = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i);
    return { date, trained: days.has(date), today: date === today, future: date > today };
  });
  return { start, days, dots, count: days.size, trainedToday: days.has(today) };
}

export function workedSets(w: Pick<Workout, "sets">): WorkoutSet[] {
  return w.sets.filter((s) => s.completed && s.kind !== "warmup");
}

export function exerciseOrder(w: Pick<Workout, "sets">): string[] {
  const seen: string[] = [];
  for (const s of [...w.sets].sort((a, b) => a.position - b.position)) {
    if (!seen.includes(s.exercise_id)) seen.push(s.exercise_id);
  }
  return seen;
}

export function volumeKg(w: Pick<Workout, "sets">): number {
  return workedSets(w).reduce((sum, s) => sum + (s.weight_kg && s.reps ? s.weight_kg * s.reps : 0), 0);
}

export function bestE1rm(sets: Pick<WorkoutSet, "weight_kg" | "reps" | "kind" | "completed">[]): number {
  return sets.reduce(
    (best, s) => (s.completed && s.kind !== "warmup" && s.weight_kg && s.reps ? Math.max(best, e1rm(s.weight_kg, s.reps)) : best),
    0,
  );
}

/**
 * What to put on the bar next time, from last session's working sets.
 *
 * Double progression: when every working set reached the top of the rep
 * range at a manageable effort, add the smallest sensible increment;
 * otherwise keep the load and chase reps. With an RPE logged on the last
 * set, nudge by roughly 3% per point of distance from the target (the
 * predecessor's auto-regulation rule, capped at 12%). Purely a suggestion -
 * it is shown as a hint and never filled in for the person.
 */
export function suggestNext(
  last: { weight_kg: number | null; reps: number | null; rpe: number | null; kind?: string }[],
  opts: { repsMax?: number | null; targetRpe?: number | null; unit: WeightUnit; exercise?: Exercise },
): { weight_kg: number; reps: number | null; reason: string } | null {
  const work = last.filter((s) => s.kind !== "warmup" && s.weight_kg && s.reps);
  if (!work.length) return null;
  const top = work.reduce((a, b) => ((b.weight_kg ?? 0) > (a.weight_kg ?? 0) ? b : a));
  const lastSet = work[work.length - 1];
  const step = opts.unit === "kg" ? 2.5 : toKg(5, "lb");
  const round = (kg: number) => {
    const inUnit = fromKg(kg, opts.unit);
    const inc = opts.unit === "kg" ? 1.25 : 2.5;
    return toKg(Math.round(inUnit / inc) * inc, opts.unit);
  };

  if (lastSet.rpe != null && opts.targetRpe != null) {
    const gap = opts.targetRpe - lastSet.rpe;
    const pct = Math.max(-0.12, Math.min(0.12, gap * 0.03));
    const next = round((top.weight_kg ?? 0) * (1 + pct));
    const reason =
      gap > 0.4 ? "Last time felt easier than planned" : gap < -0.4 ? "Last time was harder than planned" : "Right on target last time";
    return { weight_kg: next, reps: top.reps, reason };
  }
  const repsMax = opts.repsMax ?? null;
  const allTop = repsMax != null && work.every((s) => (s.reps ?? 0) >= repsMax);
  const easy = lastSet.rpe == null || lastSet.rpe <= 8.5;
  if (allTop && easy) {
    return { weight_kg: round((top.weight_kg ?? 0) + step), reps: null, reason: "You hit the top of the range" };
  }
  return { weight_kg: top.weight_kg ?? 0, reps: (top.reps ?? 0) + 1, reason: "Same weight, one more rep" };
}

export const PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25, 0.5];
export const PLATES_LB = [45, 35, 25, 10, 5, 2.5];

/** Plates per side for a target load, greedy from the heaviest available. */
export function platesFor(target: number, bar: number, available: number[]): { plates: number[]; remainder: number } {
  let perSide = (target - bar) / 2;
  const plates: number[] = [];
  if (perSide <= 0) return { plates, remainder: Math.max(0, target - bar) };
  for (const p of [...available].sort((a, b) => b - a)) {
    while (perSide + 1e-9 >= p) {
      plates.push(p);
      perSide -= p;
    }
  }
  return { plates, remainder: Math.round(perSide * 2 * 100) / 100 };
}
