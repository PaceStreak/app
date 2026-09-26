/**
 * Strength standards: a rough guide to where a lift sits, as a multiple of
 * bodyweight for an estimated one-rep max. The bands follow the widely
 * published barbell tables (beginner to elite); they are approximate, they
 * assume an adult lifting with ordinary equipment, and they are shown only
 * to the person themselves, never ranked. They are never used as a reason to
 * change bodyweight - the ratio is a lens on the bar, not the scale.
 */

export type StandardsSet = "men" | "women";
export const LEVELS = ["Beginner", "Novice", "Intermediate", "Advanced", "Elite"] as const;
export type Level = (typeof LEVELS)[number];

// Bodyweight multiples at which each level starts.
const TABLE: Record<StandardsSet, Record<string, [number, number, number, number, number]>> = {
  men: {
    "back-squat": [0.75, 1.25, 1.5, 2.25, 2.75],
    "bench-press": [0.5, 0.75, 1.25, 1.75, 2.0],
    deadlift: [1.0, 1.5, 2.0, 2.5, 3.0],
    "overhead-press": [0.35, 0.55, 0.8, 1.05, 1.35],
  },
  women: {
    "back-squat": [0.5, 0.75, 1.25, 1.5, 2.0],
    "bench-press": [0.25, 0.5, 0.75, 1.0, 1.5],
    deadlift: [0.5, 1.0, 1.25, 1.75, 2.5],
    "overhead-press": [0.2, 0.35, 0.5, 0.75, 1.0],
  },
};

export const STANDARD_LIFTS = Object.keys(TABLE.men);

export interface Standing {
  ratio: number;
  level: Level | null;
  /** The next level, and the lift that reaches it at this bodyweight. */
  next: { level: Level; kg: number } | null;
  /** 0-1 of the way from this level to the next. */
  within: number;
}

export function standing(exerciseId: string, e1rmKg: number, bodyweightKg: number, set: StandardsSet): Standing | null {
  const bands = TABLE[set][exerciseId];
  if (!bands || !(bodyweightKg > 0) || !(e1rmKg > 0)) return null;
  const ratio = e1rmKg / bodyweightKg;
  let i = -1;
  while (i + 1 < bands.length && ratio >= bands[i + 1]) i++;
  const next = i + 1 < bands.length ? { level: LEVELS[i + 1], kg: Math.round(bands[i + 1] * bodyweightKg * 2) / 2 } : null;
  const lo = i >= 0 ? bands[i] : 0;
  const hi = i + 1 < bands.length ? bands[i + 1] : bands[bands.length - 1];
  return {
    ratio: Math.round(ratio * 100) / 100,
    level: i >= 0 ? LEVELS[i] : null,
    next,
    within: next ? Math.max(0, Math.min(1, (ratio - lo) / (hi - lo))) : 1,
  };
}
