import { useMemo, useState } from "react";
import { addDays, fmtMonthDay, parseDay, weekStart } from "../lib/dates";
import type { HeatDay, WeekCell } from "../lib/types";
import { plural } from "../lib/units";

/**
 * The grid. One column per week, one square per day, brightness by how
 * much training that day held. Days inside a kept week that had no session
 * render as outlined "rest, kept" squares rather than empty ones, because
 * a planned rest day is not a gap and the grid should not say it is.
 *
 * Two more states say the same thing for other reasons: a day covered by a
 * declared pause (injury, illness, life) is hatched, and a day that isn't one
 * of the person's planned training days is marked as planned rest - so a
 * three-day plan reads as a plan, not as four failures a week.
 *
 * State is never colour alone: every square has a text title, and the legend
 * names each state.
 */
export function Heatmap({
  days,
  weeks: weekCells = [],
  today,
  weekStartsOn,
  span = 26,
  label,
  plannedDays = null,
  pauses = [],
  restDays = [],
}: {
  days: Pick<HeatDay, "date" | "level">[];
  weeks?: Pick<WeekCell, "week_start" | "status">[];
  /** Bitmask of planned training days, bit 0 = Monday. */
  plannedDays?: number | null;
  pauses?: { starts_on: string; effective_end: string }[];
  /** Rest days logged on purpose. Marked on the grid; never counted. */
  restDays?: { day: string; kind: string }[];
  today: string;
  weekStartsOn: number;
  span?: number;
  label?: string;
}) {
  const { columns, months, active } = useMemo(() => {
    const byDate = new Map(days.map((d) => [d.date, d.level]));
    const rested = new Map(restDays.map((r) => [r.day, r.kind]));
    const kept = new Set(
      weekCells.filter((w) => w.status === "kept" || w.status === "frozen" || w.status === "repaired").map((w) => w.week_start),
    );
    const paused = (date: string) => pauses.some((p) => p.starts_on <= date && date <= p.effective_end);
    const plannedRest = (date: string) =>
      Boolean(plannedDays) && ((plannedDays ?? 0) & (1 << ((parseDay(date).getUTCDay() + 6) % 7))) === 0;
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
        const [cls, state] = level
          ? [`lvl-${level}`, "trained"]
          : date > today
            ? ["lvl-future", ""]
            : paused(date)
              ? ["lvl-paused", "paused"]
              : rested.has(date)
                ? ["lvl-chosen", rested.get(date) === "rest" ? "rest day, logged" : `rest day, logged (${rested.get(date)})`]
                : kept.has(start)
                ? ["lvl-rest", "rest, week kept"]
                : plannedRest(date)
                  ? ["lvl-planned", "planned rest day"]
                  : ["lvl-0", "no session"];
        const title = state ? `${fmtMonthDay(date)}: ${state}` : fmtMonthDay(date);
        return { date, cls, title };
      });
      cols.push({ start, cells });
    }
    // A label needs about three columns. Only the first month can be shorter
    // (the grid starts mid-month), and printing it anyway overlaps the next
    // one ("SeptOct") - so the partial first month goes unlabelled.
    if (monthLabels.length > 1 && monthLabels[1].col - monthLabels[0].col < 3) monthLabels.shift();
    return { columns: cols, months: monthLabels, active: activeCount };
  }, [days, weekCells, today, weekStartsOn, span, plannedDays, pauses, restDays]);

  const [asTable, setAsTable] = useState(false);
  const statusOf = new Map(weekCells.map((w) => [w.week_start, w.status]));
  return (
    <figure className="m-0" aria-label={label ?? `Activity over the last ${span} weeks: ${plural(active, "day")} trained`}>
      {/* Left and sticky: the grid often sits in a horizontal scroller wider
          than a phone, where a right-aligned control is off-screen. */}
      <div className="sticky left-0 mb-1 flex w-fit">
        <button
          type="button"
          className="chart-toggle"
          aria-pressed={asTable}
          onClick={(e) => {
            // The grid often sits inside a link card; toggling must not navigate.
            e.preventDefault();
            e.stopPropagation();
            setAsTable(!asTable);
          }}
        >
          {asTable ? "Grid" : "Table"}
        </button>
      </div>
      {asTable ? (
        <div className="max-h-72 overflow-y-auto">
          <table className="chart-table">
            <caption className="sr-only">Training days per week, most recent first</caption>
            <thead>
              <tr>
                <th scope="col">Week of</th>
                <th scope="col">Days trained</th>
                <th scope="col">Week</th>
              </tr>
            </thead>
            <tbody>
              {[...columns].reverse().map((col) => {
                const trained = col.cells.filter((c) => c.cls.startsWith("lvl-") && /lvl-[1-4]/.test(c.cls)).length;
                const st = statusOf.get(col.start);
                return (
                  <tr key={col.start}>
                    <th scope="row">{fmtMonthDay(col.start)}</th>
                    <td className="num">{trained}</td>
                    <td className="capitalize">{st ?? "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
      <>
      {/* style via the CSSOM (React sets element.style), which a
          `style-src 'self'` policy permits; only style="" markup is blocked. */}
      <div className="heat-months" aria-hidden style={{ gridTemplateColumns: `repeat(${span}, 1fr)` }}>
        {months.map((m) => (
          <span key={m.col} className="heat-month" style={{ gridColumn: `${m.col + 1} / span 4`, gridRow: 1 }}>
            {m.text}
          </span>
        ))}
      </div>
      <div className="heat" role="img" aria-label={`${plural(active, "training day")} in ${span} weeks`}>
        {columns.map((col) => (
          <div key={col.start} className="heat-col">
            {col.cells.map((cell) => (
              <i key={cell.date} className={cell.cls} title={cell.title} />
            ))}
          </div>
        ))}
      </div>
      </>
      )}
    </figure>
  );
}

export function HeatLegend({ planned = false, paused = false, rested = false }: { planned?: boolean; paused?: boolean; rested?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-dim" aria-hidden>
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
      {planned && (
        <>
          <span className="heat ml-3 inline-flex">
            <i className="lvl-planned size-2.5" />
          </span>
          <span>Planned rest</span>
        </>
      )}
      {paused && (
        <>
          <span className="heat ml-3 inline-flex">
            <i className="lvl-paused size-2.5" />
          </span>
          <span>Paused</span>
        </>
      )}
      {rested && (
        <>
          <span className="heat ml-3 inline-flex">
            <i className="lvl-chosen size-2.5" />
          </span>
          <span>Rest logged</span>
        </>
      )}
    </div>
  );
}
