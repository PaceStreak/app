/**
 * Interval timing, as pure functions of elapsed time.
 *
 * Nothing here counts ticks. A plan is a list of phases, and "where are we"
 * is computed from how many milliseconds have elapsed since the start (minus
 * paused time). A phone that locks for three minutes comes back to the right
 * phase and the right second, which a setInterval counter never does.
 */

export type PhaseKind = "prepare" | "work" | "rest" | "done";

export interface Phase {
  kind: Exclude<PhaseKind, "done">;
  seconds: number;
  round: number;
  rounds: number;
}

export type IntervalMode = "intervals" | "emom" | "tabata";

export interface IntervalConfig {
  mode: IntervalMode;
  work: number;
  rest: number;
  rounds: number;
  /** Seconds of "get ready" before round one. */
  prepare: number;
}

export const PRESETS: Record<IntervalMode, IntervalConfig> = {
  intervals: { mode: "intervals", work: 40, rest: 20, rounds: 10, prepare: 10 },
  // Every minute on the minute: a full minute per round, the work is
  // whatever the minute holds. Modelled as one "work" phase per minute.
  emom: { mode: "emom", work: 60, rest: 0, rounds: 10, prepare: 10 },
  tabata: { mode: "tabata", work: 20, rest: 10, rounds: 8, prepare: 10 },
};

export function buildPlan(c: IntervalConfig): Phase[] {
  const rounds = Math.max(1, Math.min(99, Math.round(c.rounds)));
  const work = Math.max(1, Math.round(c.work));
  const rest = Math.max(0, Math.round(c.rest));
  const phases: Phase[] = [];
  if (c.prepare > 0) phases.push({ kind: "prepare", seconds: Math.round(c.prepare), round: 0, rounds });
  for (let r = 1; r <= rounds; r++) {
    phases.push({ kind: "work", seconds: work, round: r, rounds });
    // No rest after the last round: finishing is the rest.
    if (rest > 0 && r < rounds) phases.push({ kind: "rest", seconds: rest, round: r, rounds });
  }
  return phases;
}

export function totalSeconds(plan: Phase[]): number {
  return plan.reduce((n, p) => n + p.seconds, 0);
}

export interface Position {
  index: number;
  kind: PhaseKind;
  /** Seconds left in the current phase, fractional. */
  remaining: number;
  /** 0-1 through the current phase. */
  progress: number;
  round: number;
  rounds: number;
  /** Seconds left in the whole session. */
  totalRemaining: number;
}

export function positionAt(plan: Phase[], elapsedMs: number): Position {
  const rounds = plan[0]?.rounds ?? 0;
  let t = Math.max(0, elapsedMs) / 1000;
  const total = totalSeconds(plan);
  for (let i = 0; i < plan.length; i++) {
    const p = plan[i];
    if (t < p.seconds) {
      return {
        index: i,
        kind: p.kind,
        remaining: p.seconds - t,
        progress: t / p.seconds,
        round: p.round,
        rounds,
        totalRemaining: total - (elapsedMs / 1000),
      };
    }
    t -= p.seconds;
  }
  return { index: plan.length, kind: "done", remaining: 0, progress: 1, round: rounds, rounds, totalRemaining: 0 };
}
