import { fmtMonthDay } from "../lib/dates";
import type { HabitStats } from "../lib/types";

/**
 * A small per-habit trend: one bar per week, colour-coded the same way the
 * week strip and the calendar already are - lime for kept, flame for
 * missed, dim for paused or not-yet-judged - plus the keep-rate percentage
 * that's a plainer read of the same bars. Deliberately not a full chart
 * library: a CSS bar row is enough for "how has this gone lately", and the
 * CSP here ships no third-party scripts.
 */
export function HabitTrend({ stats }: { stats: HabitStats }) {
  const weeks = stats.weeks;
  if (weeks.length < 2) return null;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm text-dim">
          Kept <span className="num font-semibold text-ink">{stats.weeks_kept}</span> of{" "}
          <span className="num">{stats.weeks_counted}</span> weeks judged so far
        </p>
        <p className="num text-lg font-semibold text-accent-text">{stats.keep_rate}%</p>
      </div>
      <div className="mt-2 flex h-8 items-end gap-[3px]" aria-label={`Weekly keep rate over the last ${weeks.length} weeks: ${stats.keep_rate}% kept`}>
        {weeks.map((w) => {
          const kept = w.status === "kept" || w.status === "frozen" || w.status === "repaired";
          const missed = w.status === "missed";
          const pct = Math.max(10, Math.round((w.days / Math.max(1, w.target)) * 100));
          return (
            <span
              key={w.week_start}
              title={`Week of ${fmtMonthDay(w.week_start)}: ${w.days}/${w.target} · ${w.status}`}
              className={`min-w-[2px] flex-1 rounded-none ${
                kept ? "bg-accent" : missed ? "bg-flame/70" : w.status === "open" ? "bg-accent/35" : "bg-surface-2"
              }`}
              style={{ height: `${Math.min(100, pct)}%` }}
            />
          );
        })}
      </div>
      <p className="mt-1.5 text-xs text-dim">
        Each bar is a week, oldest first. Lime means kept, flame means missed; the rate only counts weeks that have closed.
      </p>
    </div>
  );
}
