import { useState } from "react";

export interface Bar {
  key: string;
  label: string;
  value: number;
  display: string;
  dim?: boolean;
}

/**
 * One series of bars, one hue. Identity comes from the title, so there is
 * no legend; the value is on hover or focus, and a visually hidden table
 * carries the same numbers for screen readers.
 */
export function BarChart({
  title,
  bars,
  target,
  targetLabel,
  axisLabels = true,
}: {
  title: string;
  bars: Bar[];
  target?: number | null;
  targetLabel?: string;
  axisLabels?: boolean;
}) {
  const [active, setActive] = useState<string | null>(null);
  const max = Math.max(1, target ?? 0, ...bars.map((b) => b.value)) * 1.08;
  const every = Math.ceil(bars.length / 6);
  return (
    <figure className="m-0">
      <div className="bars" onPointerLeave={() => setActive(null)} aria-hidden>
        {target != null && target > 0 && <span className="bar-target" style={{ bottom: `${(target / max) * 100}%` }} />}
        {bars.map((b) => (
          <div
            key={b.key}
            className="bar"
            tabIndex={-1}
            data-dim={b.dim}
            data-empty={b.value === 0}
            onPointerEnter={() => setActive(b.key)}
            onClick={() => setActive(active === b.key ? null : b.key)}
          >
            <span style={{ height: `${Math.max(1.5, (b.value / max) * 100)}%` }} />
            {active === b.key && (
              <span className="bar-tip">
                <b className="num">{b.display}</b> <span className="text-dim">{b.label}</span>
              </span>
            )}
          </div>
        ))}
      </div>
      {axisLabels && (
        <div className="mt-1.5 grid grid-flow-col text-[0.7rem] text-dim" style={{ gridAutoColumns: "1fr" }} aria-hidden>
          {bars.map((b, i) => (
            <span key={b.key} className="truncate">
              {i % every === 0 ? b.label : ""}
            </span>
          ))}
        </div>
      )}
      {target != null && targetLabel && (
        <figcaption className="mt-2 flex items-center gap-2 text-xs text-dim">
          <span className="inline-block w-5 border-t-[1.5px] border-dashed border-muted" /> {targetLabel}
        </figcaption>
      )}
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {bars.map((b) => (
            <tr key={b.key}>
              <th scope="row">{b.label}</th>
              <td>{b.display}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
