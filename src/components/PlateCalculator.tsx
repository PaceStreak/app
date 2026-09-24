import { useState } from "react";
import { PLATES_KG, PLATES_LB, platesFor } from "../lib/training";
import { parseNumber, type WeightUnit } from "../lib/units";

/** Plates per side for a target, in the user's own unit. Plate widths are
 * drawn to scale-ish so the stack reads like the bar you are about to load. */
export function PlateCalculator({ unit, initial }: { unit: WeightUnit; initial?: number }) {
  const [target, setTarget] = useState(initial ? String(initial) : unit === "kg" ? "100" : "225");
  const [bar, setBar] = useState(unit === "kg" ? 20 : 45);
  const available = unit === "kg" ? PLATES_KG : PLATES_LB;
  const t = parseNumber(target) ?? 0;
  const { plates, remainder } = platesFor(t, bar, available);
  const heaviest = available[0];

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label" htmlFor="pc-target">Target ({unit})</label>
          <input id="pc-target" className="input num text-lg" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="pc-bar">Bar ({unit})</label>
          <select id="pc-bar" className="input" value={bar} onChange={(e) => setBar(Number(e.target.value))}>
            {(unit === "kg" ? [20, 15, 10, 25] : [45, 35, 25, 55]).map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-6 flex h-28 items-center justify-center gap-[3px]" aria-hidden>
        <span className="h-3 w-10 rounded-l-sm bg-line-lit" />
        {[...plates].reverse().map((p, i) => (
          <span key={`l${i}`} className="plate" data-heavy={p >= heaviest * 0.75} style={{ height: `${36 + (p / heaviest) * 64}%` }} />
        ))}
        <span className="h-3 w-16 bg-line-lit" />
        {plates.map((p, i) => (
          <span key={`r${i}`} className="plate" data-heavy={p >= heaviest * 0.75} style={{ height: `${36 + (p / heaviest) * 64}%` }} />
        ))}
        <span className="h-3 w-10 rounded-r-sm bg-line-lit" />
      </div>

      <p className="mt-4 text-center text-sm text-dim">Each side</p>
      <p className="num text-center text-xl font-semibold">{plates.length ? plates.join(" + ") : t <= bar ? "Just the bar" : "No plates"}</p>
      {remainder > 0 && (
        <p className="mt-2 text-center text-sm text-flame-text">
          {remainder} {unit} short with standard plates. Closest: {t - remainder} {unit}.
        </p>
      )}
    </div>
  );
}
