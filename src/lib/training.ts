import { addDays, localDateOf, weekStart } from "./dates";
import { e1rm, fromKg, toKg, type WeightUnit } from "./units";
import type { Chain, Exercise, Gear, Workout, WorkoutSet } from "./types";

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
    tags: [],
    gear_id: null,
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
export interface Suggestion {
  weight_kg: number;
  reps: number | null;
  duration_sec?: number | null;
  reason: string;
}

export function suggestNext(
  last: { weight_kg: number | null; reps: number | null; rpe: number | null; kind?: string; duration_sec?: number | null }[],
  opts: { repsMax?: number | null; targetRpe?: number | null; stepKg?: number | null; unit: WeightUnit; exercise?: Exercise },
): Suggestion | null {
  const work = last.filter((s) => s.kind !== "warmup" && s.weight_kg && s.reps);
  if (!work.length) return suggestUnloaded(last, opts.repsMax ?? null);
  const top = work.reduce((a, b) => ((b.weight_kg ?? 0) > (a.weight_kg ?? 0) ? b : a));
  const lastSet = work[work.length - 1];
  // A routine can set its own jump: 5 kg suits a deadlift, 1 kg a raise.
  const step = opts.stepKg || (opts.unit === "kg" ? 2.5 : toKg(5, "lb"));
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

/**
 * Bodyweight reps and timed holds: the same idea without a bar. One more
 * rep, or a few more seconds, until the top of the rep range - then say so,
 * because past that point progress means a harder variation or added load,
 * not an ever-longer set.
 */
function suggestUnloaded(
  last: { reps: number | null; kind?: string; duration_sec?: number | null }[],
  repsMax: number | null,
): Suggestion | null {
  const work = last.filter((s) => s.kind !== "warmup");
  const holds = work.filter((s) => s.duration_sec && !s.reps);
  if (holds.length) {
    const best = Math.max(...holds.map((s) => s.duration_sec ?? 0));
    const step = best < 60 ? 5 : 10;
    return { weight_kg: 0, reps: null, duration_sec: best + step, reason: `${step} seconds more than your best hold` };
  }
  const reps = work.filter((s) => s.reps);
  if (!reps.length) return null;
  const best = Math.max(...reps.map((s) => s.reps ?? 0));
  if (repsMax != null && reps.every((s) => (s.reps ?? 0) >= repsMax)) {
    return { weight_kg: 0, reps: repsMax, reason: "Top of the range: time for a harder variation or a little load" };
  }
  return { weight_kg: 0, reps: best + 1, reason: "One more rep than last time" };
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

/** The gear new sessions of this discipline use by default, if any. */
export function defaultGear(gear: Gear[] | undefined, discipline: string): string | null {
  return gear?.find((g) => !g.retired && g.default_for.includes(discipline))?.id ?? null;
}

/**
 * Search the sessions on this device: title, notes, tags, discipline and
 * exercise names. Offline by construction - everything searched is already
 * in IndexedDB. Every word must match somewhere ("hill sam" finds the hill
 * session tagged with-sam); a leading # searches tags only.
 */
export function searchWorkouts(workouts: Workout[], query: string, names: (exerciseId: string) => string | undefined, disciplineName: (id: string) => string | undefined): Workout[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return workouts;
  return workouts.filter((w) => {
    const tags = (w.tags ?? []).join(" ");
    const text = [w.title, w.notes, disciplineName(w.discipline), ...w.sets.map((s) => names(s.exercise_id))]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return words.every((word) => (word.startsWith("#") ? (w.tags ?? []).some((t) => t.startsWith(word.slice(1))) : text.includes(word) || tags.includes(word)));
  });
}

/** Same rules as the API (clean_tags): "#Hill Reps" -> "hill-reps". */
export function cleanTag(raw: string): string {
  return raw.trim().replace(/^#+/, "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24);
}

/**
 * Warm-up ramp towards a working weight: about 40% x 8, 60% x 5 and 80% x 3,
 * starting no lighter than the empty bar and rounded to what plates can
 * make. Steps that round to the same load, or to the working weight
 * itself, are dropped. Stored in kg; `unit` only decides the rounding.
 */
export function warmupSets(workingKg: number, unit: WeightUnit): { weight_kg: number; reps: number }[] {
  const bar = unit === "kg" ? 20 : toKg(45, "lb");
  if (!(workingKg > bar)) return [];
  const step = unit === "kg" ? 2.5 : 5;
  const round = (kg: number) => toKg(Math.round(fromKg(kg, unit) / step) * step, unit);
  const out: { weight_kg: number; reps: number }[] = [];
  for (const [pct, reps] of [[0, 10], [0.4, 8], [0.6, 5], [0.8, 3]] as const) {
    const kg = pct === 0 ? bar : Math.max(bar, round(workingKg * pct));
    if (kg >= workingKg - 0.01) break;
    if (out.some((o) => Math.abs(o.weight_kg - kg) < 0.01)) continue;
    out.push({ weight_kg: Math.round(kg * 1000) / 1000, reps });
  }
  return out;
}
