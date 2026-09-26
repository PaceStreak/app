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
  /** A deliberate step back after a stall, not progress. */
  reset?: boolean;
}

export function suggestNext(
  last: { weight_kg: number | null; reps: number | null; rpe: number | null; kind?: string; duration_sec?: number | null }[],
  opts: {
    repsMin?: number | null;
    repsMax?: number | null;
    targetRpe?: number | null;
    stepKg?: number | null;
    unit: WeightUnit;
    exercise?: Exercise;
    /** Top working set of each earlier session, most recent first, not including `last`. */
    earlier?: { weight_kg: number; reps: number }[];
  },
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

  // Stuck: the same top weight for three sessions without a rep gained, or
  // twice short of the bottom of the range. Grinding on rarely breaks that;
  // stepping back about 10% and building up again usually does.
  const recent = [{ weight_kg: top.weight_kg ?? 0, reps: top.reps ?? 0 }, ...(opts.earlier ?? [])];
  const same = (n: number) => recent.length >= n && recent.slice(0, n).every((r) => Math.abs(r.weight_kg - recent[0].weight_kg) < 0.01);
  const shortTwice = opts.repsMin != null && same(2) && recent.slice(0, 2).every((r) => r.reps < opts.repsMin!);
  const flat = same(3) && recent[0].reps <= recent[2].reps && recent[1].reps <= recent[2].reps;
  if (shortTwice || flat) {
    return {
      weight_kg: round((top.weight_kg ?? 0) * 0.9),
      reps: opts.repsMax ?? top.reps,
      reason: shortTwice ? "Two sessions short of the range: step back 10% and build again" : "Stuck at this weight for three sessions: step back 10% and build again",
      reset: true,
    };
  }

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

/** Top working set per session for an exercise, newest first, from this device. */
export function sessionTops(workouts: Workout[], exerciseId: string, excludeId?: string): { date: string; weight_kg: number; reps: number; e1rm: number; rpe: number | null }[] {
  const out: { date: string; weight_kg: number; reps: number; e1rm: number; rpe: number | null }[] = [];
  for (const w of workouts) {
    if (w.id === excludeId || w.deleted_at) continue;
    const sets = w.sets.filter((s) => s.exercise_id === exerciseId && s.completed && s.kind !== "warmup" && s.weight_kg && s.reps);
    if (!sets.length) continue;
    const top = sets.reduce((a, b) => ((b.weight_kg ?? 0) > (a.weight_kg ?? 0) || ((b.weight_kg ?? 0) === (a.weight_kg ?? 0) && (b.reps ?? 0) > (a.reps ?? 0)) ? b : a));
    const rpes = sets.map((s) => s.rpe).filter((r): r is number => r != null);
    out.push({
      date: w.local_date,
      weight_kg: top.weight_kg!,
      reps: top.reps!,
      e1rm: bestE1rm(sets),
      rpe: rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null,
    });
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : -1));
}

/**
 * Typed shorthand for a set, so logging needs no taps between numbers:
 * "100x5" (weight x reps), "100x5x3" (and sets), "3x5@100" (sets x reps at
 * weight), "5@100", or a bare "12" (reps, for bodyweight work). Weight is in
 * whatever unit the person uses; "x", "X", "*" and "×" all work.
 */
export function parseShorthand(text: string): { weight: number | null; reps: number; sets: number } | null {
  const t = text.trim().toLowerCase().replace(/[×*]/g, "x").replace(/\s+/g, "").replace(/,/g, ".");
  let m = t.match(/^(\d+)x(\d+)@(\d+(?:\.\d+)?)$/);
  if (m) return ok(Number(m[3]), Number(m[2]), Number(m[1]));
  m = t.match(/^(\d+)@(\d+(?:\.\d+)?)$/);
  if (m) return ok(Number(m[2]), Number(m[1]), 1);
  m = t.match(/^(\d+(?:\.\d+)?)x(\d+)(?:x(\d+))?$/);
  if (m) return ok(Number(m[1]), Number(m[2]), m[3] ? Number(m[3]) : 1);
  m = t.match(/^(\d+)$/);
  if (m) return ok(null, Number(m[1]), 1);
  return null;

  function ok(weight: number | null, reps: number, sets: number) {
    if (!(reps >= 1 && reps <= 100) || !(sets >= 1 && sets <= 20) || (weight != null && !(weight > 0 && weight <= 1000))) return null;
    return { weight, reps, sets };
  }
}

/**
 * Days since each muscle last did primary work, and hard sets on it in the
 * last seven days - a rough recovery map. Rough on purpose: soreness and
 * sleep matter more than any count, so this only says what was trained when.
 */
export function muscleRecovery(workouts: Workout[], exercises: Map<string, Exercise>, today: string): Map<string, { daysSince: number; sets7: number }> {
  const out = new Map<string, { daysSince: number; sets7: number }>();
  const weekAgo = addDays(today, -6);
  for (const w of workouts) {
    if (w.deleted_at || w.local_date > today) continue;
    const since = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${w.local_date}T00:00:00Z`)) / 86_400_000);
    for (const s of w.sets) {
      if (!s.completed || s.kind === "warmup") continue;
      for (const m of exercises.get(s.exercise_id)?.primary ?? []) {
        const cur = out.get(m) ?? { daysSince: Infinity, sets7: 0 };
        cur.daysSince = Math.min(cur.daysSince, since);
        if (w.local_date >= weekAgo) cur.sets7 += 1;
        out.set(m, cur);
      }
    }
  }
  return out;
}

/** One edit apart (insert, delete, substitute or swap two neighbours). */
export function nearly(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const restA = a.slice(i);
  const restB = b.slice(i);
  if (restA.slice(1) === restB.slice(1)) return true; // substitute
  if (restA.slice(1) === restB || restA === restB.slice(1)) return true; // delete / insert
  return restA.length >= 2 && restA[0] === restB[1] && restA[1] === restB[0] && restA.slice(2) === restB.slice(2); // swap
}

/**
 * Does a search term match some text, forgiving one typo per word of four or
 * more letters? "benhc prss" finds "Bench press"; short words must match
 * exactly, so "row" doesn't find "raw".
 */
export function fuzzyMatch(term: string, text: string): boolean {
  const hay = text.toLowerCase();
  const words = hay.split(/[^a-z0-9]+/).filter(Boolean);
  return term
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((t) => hay.includes(t) || (t.length >= 4 && words.some((w) => nearly(t, w) || (w.length > t.length && nearly(t, w.slice(0, t.length))))));
}
