import { useState } from "react";
import { PLATES_KG, PLATES_LB, loadedTotal, platesFor } from "../lib/training";
import { usePersistentState } from "../lib/persist";
import { parseNumber, type WeightUnit } from "../lib/units";
import { Segmented } from "./ui";

type Mode = "load" | "target";

/**
 * Two directions of the same bar. "Load the bar": pick the bar, tap the
 * plates on one side, read the total - no mental arithmetic mid-set. "From a
 * total": type a target and see what goes on each side. Works in the user's
 * own unit throughout.
 *
 * The bar is remembered per exercise on this device (`barKey`), so curls keep
 * the EZ bar and squats keep the 20 kg bar.
 */
export function PlateCalculator({
  unit,
  initial,
  plates: gymPlates,
  bar: gymBar,
  gymName,
  barKey = "tools",
  onUse,
}: {
  unit: WeightUnit;
  initial?: number;
  plates?: number[];
  bar?: number;
  gymName?: string;
  /** Which bar to remember: an exercise id, or the standalone tool. */
  barKey?: string;
  /** Fill a set with the loaded total. Without it the load mode is read-only. */
  onUse?: (total: number) => void;
}) {
  const standardBar = unit === "kg" ? 20 : 45;
  const [bar, setBar] = usePersistentState<number>(`bar.${unit}.${barKey}`, gymBar ?? standardBar);
  const [mode, setMode] = usePersistentState<Mode>("plates.mode", "load", ["load", "target"]);
  // A gym's own plates when there is one; a full commercial set otherwise.
  const available = gymPlates?.length ? [...gymPlates].sort((a, b) => b - a) : unit === "kg" ? PLATES_KG : PLATES_LB;
  const heaviest = available[0];

  // Open on whatever the set already says, so the bar shows what's loaded.
  const [side, setSide] = useState<number[]>(() => (initial ? platesFor(initial, bar, available).plates : []));
  const [target, setTarget] = useState(initial ? String(initial) : unit === "kg" ? "100" : "225");
  const [customBar, setCustomBar] = useState("");

  const t = parseNumber(target) ?? 0;
  const fromTarget = platesFor(t, bar, available);
  const shown = mode === "load" ? side : fromTarget.plates;
  const total = loadedTotal(bar, side);
  const bars = [...new Set([bar, ...(gymBar ? [gymBar] : []), ...(unit === "kg" ? [20, 15, 10, 25] : [45, 35, 25, 55])])];

  return (
    <div>
      <Segmented
        label="Calculator"
        value={mode}
        onChange={setMode}
        options={[
          { value: "load", label: "Load the bar" },
          { value: "target", label: "From a total" },
        ]}
      />

      <div className="mt-4">
        <span className="field-label">Bar ({unit})</span>
        <div className="flex flex-wrap gap-2">
          {bars.map((b) => (
            <button key={b} type="button" aria-pressed={bar === b} className={`chip h-9 num ${bar === b ? "chip-accent" : ""}`} onClick={() => setBar(b)}>
              {b}
              {b === gymBar && gymName ? <span className="text-dim"> · gym</span> : null}
            </button>
          ))}
          <input
            className="input h-9 w-24 num"
            inputMode="decimal"
            placeholder="Other"
            aria-label={`Other bar weight in ${unit}`}
            value={customBar}
            onChange={(e) => setCustomBar(e.target.value)}
            onBlur={() => {
              const v = parseNumber(customBar);
              if (v != null && v >= 0) setBar(v);
              setCustomBar("");
            }}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          />
        </div>
      </div>

      {mode === "target" && (
        <div className="mt-4">
          <label className="field-label" htmlFor="pc-target">Target ({unit})</label>
          <input id="pc-target" className="input num text-lg" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />
        </div>
      )}

      <div className="mt-6 flex h-28 items-center justify-center gap-[3px]">
        <span className="h-3 w-10 rounded-l-sm bg-line-lit" aria-hidden />
        {[...shown].reverse().map((p, i) => (
          <span key={`l${i}`} className="plate" data-heavy={p >= heaviest * 0.75} style={{ height: `${36 + (p / heaviest) * 64}%` }} aria-hidden />
        ))}
        <span className="h-3 w-16 bg-line-lit" aria-hidden />
        {shown.map((p, i) =>
          mode === "load" ? (
            <button
              key={`r${i}`}
              type="button"
              className="plate"
              data-heavy={p >= heaviest * 0.75}
              style={{ height: `${36 + (p / heaviest) * 64}%` }}
              aria-label={`Remove a ${p} ${unit} plate`}
              onClick={() => setSide((s) => s.filter((_, j) => j !== i))}
            />
          ) : (
            <span key={`r${i}`} className="plate" data-heavy={p >= heaviest * 0.75} style={{ height: `${36 + (p / heaviest) * 64}%` }} aria-hidden />
          ),
        )}
        <span className="h-3 w-10 rounded-r-sm bg-line-lit" aria-hidden />
      </div>

      {mode === "load" ? (
        <>
          <p className="mt-4 text-center text-sm text-dim">Tap a plate to add it to each side</p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {available.map((p) => (
              <button key={p} type="button" className="chip h-10 min-w-12 num" aria-label={`Add ${p} ${unit} to each side`} onClick={() => setSide((s) => [...s, p].sort((a, b) => b - a))}>
                {p}
              </button>
            ))}
            <button type="button" className="chip h-10" disabled={!side.length} onClick={() => setSide([])}>
              Clear
            </button>
          </div>
          <p className="mt-5 text-center text-sm text-dim">
            {side.length ? `${bar} bar + 2 × (${side.join(" + ")})` : "Just the bar"}
          </p>
          <p className="num text-center text-4xl font-semibold" aria-live="polite">
            {total} <span className="text-xl text-muted">{unit}</span>
          </p>
          {onUse && (
            <button type="button" className="btn btn-primary mt-5 w-full" onClick={() => onUse(total)}>
              Use {total} {unit}
            </button>
          )}
        </>
      ) : (
        <>
          <p className="mt-4 text-center text-sm text-dim">Each side</p>
          <p className="num text-center text-xl font-semibold">{shown.length ? shown.join(" + ") : t <= bar ? "Just the bar" : "No plates"}</p>
          {fromTarget.remainder > 0 && (
            <p className="mt-2 text-center text-sm text-flame-text">
              {fromTarget.remainder} {unit} short with {gymName ? `the plates at ${gymName}` : "standard plates"}. Closest: {t - fromTarget.remainder} {unit}.
            </p>
          )}
        </>
      )}
    </div>
  );
}
