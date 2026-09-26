import { addDays } from "./dates";
import type { Exercise, Workout } from "./types";

/**
 * Training load: minutes x effort, a simple and well-known session-RPE
 * measure. A session with no effort rating counts as 5, "steady", and one
 * with no duration as 30 minutes. It exists to spot a sudden jump - this
 * week well above the last four - which is when niggles tend to start. It is
 * private, never ranked and never a target.
 */
export function sessionLoad(w: Pick<Workout, "duration_sec" | "effort">): number {
  const minutes = w.duration_sec ? w.duration_sec / 60 : 30;
  return Math.round(minutes * (w.effort ?? 5));
}

export interface LoadSummary {
  /** Last 7 days. */
  acute: number;
  /** Weekly average over the last 28 days. */
  chronic: number;
  /** acute / chronic, or null with too little history to compare. */
  ratio: number | null;
  state: "building" | "steady" | "easing" | "spike" | "new";
  /** Weekly totals, oldest first, for a chart. */
  weeks: { start: string; load: number }[];
}

export function trainingLoad(workouts: Workout[], today: string, weeks = 12): LoadSummary {
  const live = workouts.filter((w) => !w.deleted_at && w.local_date <= today);
  const sum = (from: string) => live.filter((w) => w.local_date > from).reduce((n, w) => n + sessionLoad(w), 0);
  const acute = sum(addDays(today, -7));
  const chronic = Math.round(sum(addDays(today, -28)) / 4);
  const earliest = live.reduce((m, w) => (w.local_date < m ? w.local_date : m), today);
  const enoughHistory = earliest <= addDays(today, -21) && chronic > 0;
  const ratio = enoughHistory ? Math.round((acute / chronic) * 100) / 100 : null;
  const state: LoadSummary["state"] =
    ratio == null ? "new" : ratio > 1.5 ? "spike" : ratio > 1.15 ? "building" : ratio < 0.7 ? "easing" : "steady";
  const out: { start: string; load: number }[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const end = addDays(today, -7 * i);
    const start = addDays(end, -6);
    out.push({ start, load: live.filter((w) => w.local_date >= start && w.local_date <= end).reduce((n, w) => n + sessionLoad(w), 0) });
  }
  return { acute, chronic, ratio, state, weeks: out };
}

const LEGS = new Set(["quads", "hamstrings", "glutes", "calves"]);
const ENDURANCE_LEGS = new Set(["run", "ride", "row", "walk"]);

/** Hard leg work in a session: working sets whose main muscles are legs. */
export function legSets(w: Workout, exercises: Map<string, Exercise>): number {
  return w.sets.filter((s) => s.completed && s.kind !== "warmup" && (exercises.get(s.exercise_id)?.primary ?? []).some((m) => LEGS.has(m))).length;
}

/** A run, ride or row that was hard: effort 7+ or long for the person. */
function hardEndurance(w: Workout): boolean {
  return ENDURANCE_LEGS.has(w.discipline) && w.discipline !== "walk" && ((w.effort ?? 0) >= 7 || (w.duration_sec ?? 0) >= 75 * 60);
}

export interface Conflict {
  kind: "legs-then-hard-cardio" | "hard-cardio-then-legs";
  yesterday: string;
}

/**
 * What yesterday did to today's plan, for people who both lift and run:
 * heavy legs yesterday and a run planned today, or a hard run yesterday and
 * a leg session planned today. The answer is never "skip"; it's "keep it
 * easy", because two hard things back to back is when form and joints give.
 */
export function conflictFor(workouts: Workout[], exercises: Map<string, Exercise>, today: string, planned: { discipline: string; legs?: boolean } | null): Conflict | null {
  if (!planned) return null;
  const yesterday = addDays(today, -1);
  const prior = workouts.filter((w) => !w.deleted_at && w.local_date === yesterday);
  const heavyLegs = prior.some((w) => legSets(w, exercises) >= 6);
  const hardCardio = prior.some(hardEndurance);
  if (heavyLegs && ENDURANCE_LEGS.has(planned.discipline) && planned.discipline !== "walk") return { kind: "legs-then-hard-cardio", yesterday };
  if (hardCardio && planned.discipline === "strength" && planned.legs) return { kind: "hard-cardio-then-legs", yesterday };
  return null;
}
