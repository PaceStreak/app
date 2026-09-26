import { useState } from "react";

export interface LinePoint {
  key: string;
  label: string;
  /** The raw reading, drawn as a dot. */
  value: number;
  /** The smoothed value, drawn as the line. */
  trend: number;
  display: string;
  trendDisplay: string;
}

const W = 320;
const H = 150;
const PAD = 6;

/**
 * Raw readings as faint dots, the trend as one line through them. Scale is the
 * data's own range, not zero-based: a 2 kg change on an 80 kg axis from zero
 * would be a flat line. Like BarChart, a "Table" toggle shows the numbers, and
 * the table is always there for screen readers.
 */
export function LineChart({ title, points, unit }: { title: string; points: LinePoint[]; unit: string }) {
  const [active, setActive] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const all = points.flatMap((p) => [p.value, p.trend]);
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const span = Math.max(hi - lo, 1);
  const min = lo - span * 0.1;
  const max = hi + span * 0.1;
  const x = (i: number) => (points.length === 1 ? W / 2 : PAD + (i / (points.length - 1)) * (W - PAD * 2));
  const y = (v: number) => PAD + (1 - (v - min) / (max - min)) * (H - PAD * 2);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.trend).toFixed(1)}`).join(" ");
  const pick = (clientX: number, rect: DOMRect) => {
    const rel = ((clientX - rect.left) / rect.width) * W;
    setActive(Math.max(0, Math.min(points.length - 1, Math.round(((rel - PAD) / (W - PAD * 2)) * (points.length - 1)))));
  };
  const a = active != null ? points[active] : null;

  return (
    <figure className="m-0">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="num min-h-5 truncate text-xs text-muted" aria-hidden>
          {a ? (
            <>
              <b className="text-ink">{a.display}</b> {a.label} · 7-day {a.trendDisplay}
            </>
          ) : (
            <span className="text-dim">
              {hi.toFixed(1)}–{lo.toFixed(1)} {unit}
            </span>
          )}
        </p>
        <button type="button" className="chart-toggle" aria-pressed={asTable} onClick={() => setAsTable(!asTable)}>
          {asTable ? "Chart" : "Table"}
        </button>
      </div>
      {!asTable && (
        <>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="block w-full touch-none select-none"
            aria-hidden
            onPointerMove={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
            onPointerDown={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
            onPointerLeave={() => setActive(null)}
          >
            {[0.25, 0.5, 0.75].map((f) => (
              <line key={f} x1={0} x2={W} y1={PAD + f * (H - PAD * 2)} y2={PAD + f * (H - PAD * 2)} className="stroke-line" strokeWidth={1} />
            ))}
            {points.map((p, i) => (
              <circle key={p.key} cx={x(i)} cy={y(p.value)} r={active === i ? 3.5 : 2} className={active === i ? "fill-ink" : "fill-dim"} />
            ))}
            <path d={line} fill="none" className="stroke-accent-text" strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" />
            {a && <line x1={x(active!)} x2={x(active!)} y1={0} y2={H} className="stroke-line-lit" strokeWidth={1} />}
          </svg>
          <div className="mt-1.5 flex justify-between text-[0.7rem] text-dim" aria-hidden>
            <span>{points[0]?.label}</span>
            <span>{points[points.length - 1]?.label}</span>
          </div>
        </>
      )}
      <table className={asTable ? "chart-table" : "sr-only"}>
        <caption className={asTable ? "sr-only" : undefined}>{title}</caption>
        <thead className={asTable ? undefined : "sr-only"}>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Reading</th>
            <th scope="col">7-day average</th>
          </tr>
        </thead>
        <tbody>
          {[...points].reverse().map((p) => (
            <tr key={p.key}>
              <th scope="row">{p.label}</th>
              <td className="num">{p.display}</td>
              <td className="num">{p.trendDisplay}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
