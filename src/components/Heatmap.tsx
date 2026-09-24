import { useMemo } from "react";
import { addDays, fmtMonthDay, parseDay, weekStart } from "../lib/dates";
import type { HeatDay, WeekCell } from "../lib/types";

/**
 * The grid. One column per week, one square per day, brightness by how
 * much training that day held. Days inside a kept week that had no session
 * render as outlined "rest, kept" squares rather than empty ones, because
 * a planned rest day is not a gap and the grid should not say it is.
 */
export function Heatmap({
  days,
  weeks: weekCells = [],
  today,
  weekStartsOn,
  span = 26,
  label,
}: {
  days: Pick<HeatDay, "date" | "level">[];
  weeks?: Pick<WeekCell, "week_start" | "status">[];
  today: string;
  weekStartsOn: number;
  span?: number;
  label?: string;
}) {
  const { columns, months, active } = useMemo(() => {
    const byDate = new Map(days.map((d) => [d.date, d.level]));
    const kept = new Set(weekCells.filter((w) => w.status !== "missed" && w.status !== "open").map((w) => w.week_start));
    const last = weekStart(today, weekStartsOn);
    const first = addDays(last, -7 * (span - 1));
    const cols: { start: string; cells: { date: string; cls: string; title: string }[] }[] = [];
    const monthLabels: { col: number; text: string }[] = [];
    let activeCount = 0;
    for (let c = 0; c < span; c++) {
      const start = addDays(first, c * 7);
      const month = parseDay(start).getUTCMonth();
      if (c === 0 || parseDay(addDays(start, -7)).getUTCMonth() !== month) {
        monthLabels.push({ col: c, text: parseDay(start).toLocaleDateString(undefined, { month: "short", timeZone: "UTC" }) });
      }
      const cells = Array.from({ length: 7 }, (_, r) => {
        const date = addDays(start, r);
        const level = byDate.get(date);
        if (level) activeCount++;
        const cls = date > today ? "lvl-future" : level ? `lvl-${level}` : kept.has(start) ? "lvl-rest" : "lvl-0";
        const title = `${fmtMonthDay(date)}: ${level ? "trained" : cls === "lvl-rest" ? "rest, week kept" : date > today ? "" : "no session"}`;
        return { date, cls, title };
      });
      cols.push({ start, cells });
    }
    return { columns: cols, months: monthLabels, active: activeCount };
  }, [days, weekCells, today, weekStartsOn, span]);

  return (
    <figure className="m-0" aria-label={label ?? `Activity over the last ${span} weeks: ${active} days trained`}>
      {/* style via the CSSOM (React sets element.style), which a
          `style-src 'self'` policy permits; only style="" markup is blocked. */}
      <div className="heat-months" aria-hidden style={{ gridTemplateColumns: `repeat(${span}, 1fr)` }}>
        {months.map((m) => (
          <span key={m.col} className="heat-month" style={{ gridColumn: `${m.col + 1} / span 4`, gridRow: 1 }}>
            {m.text}
          </span>
        ))}
      </div>
      <div className="heat" role="img" aria-label={`${active} training days in ${span} weeks`}>
        {columns.map((col) => (
          <div key={col.start} className="heat-col">
            {col.cells.map((cell) => (
              <i key={cell.date} className={cell.cls} title={cell.title} />
            ))}
          </div>
        ))}
      </div>
    </figure>
  );
}

export function HeatLegend() {
  return (
    <div className="flex items-center gap-1.5 text-xs text-dim" aria-hidden>
      <span>Less</span>
      <span className="heat inline-flex gap-1">
        {[0, 1, 2, 3, 4].map((l) => (
          <i key={l} className={`lvl-${l} size-2.5`} />
        ))}
      </span>
      <span>More</span>
      <span className="heat ml-3 inline-flex">
        <i className="lvl-rest size-2.5" />
      </span>
      <span>Rest, kept</span>
    </div>
  );
}
