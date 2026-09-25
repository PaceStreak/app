/**
 * The last N weeks as small marks, oldest first, always N wide: weeks before
 * the history starts are drawn as faint placeholders, so one week of data is
 * one mark in a row of twelve, not a single stretched box.
 */
const LABEL: Record<string, string> = { kept: "kept", missed: "missed", paused: "paused", open: "in progress", frozen: "frozen", repaired: "repaired" };

export function WeekStrip({ weeks, slots = 12, label }: { weeks: string[]; slots?: number; label: string }) {
  const shown = weeks.slice(-slots);
  const pad = slots - shown.length;
  return (
    <ol className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${slots}, minmax(0, 1fr))` }} aria-label={label}>
      {Array.from({ length: pad }, (_, i) => (
        <li key={`pad${i}`} className="week-mark is-none" aria-hidden />
      ))}
      {shown.map((w, i) => (
        <li key={i} className={`week-mark is-${w}`}>
          <span className="sr-only">{LABEL[w] ?? w}</span>
        </li>
      ))}
    </ol>
  );
}
