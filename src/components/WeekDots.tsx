import { WEEKDAYS, weekday } from "../lib/dates";

/** Seven days of the current week. Filled = trained, ring = today. */
export function WeekDots({
  dots,
  size = "md",
}: {
  dots: { date: string; trained: boolean; today: boolean; future: boolean }[];
  size?: "sm" | "md";
}) {
  const s = size === "sm" ? "size-2.5" : "size-7";
  return (
    <ol className={`flex ${size === "sm" ? "gap-1" : "gap-1.5"}`} aria-label="This week">
      {dots.map((d) => (
        <li key={d.date} className="flex flex-col items-center gap-1">
          <span
            className={`week-dot ${s} ${d.trained ? "is-trained" : ""} ${d.today ? "is-today" : ""} ${d.future ? "is-future" : ""}`}
            aria-label={`${WEEKDAYS[weekday(d.date)]}: ${d.trained ? "trained" : d.future ? "to come" : "rest"}`}
          />
          {size === "md" && <span className={`text-[0.65rem] font-semibold ${d.today ? "text-ink" : "text-dim"}`}>{WEEKDAYS[weekday(d.date)][0]}</span>}
        </li>
      ))}
    </ol>
  );
}
