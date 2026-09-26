import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { api } from "../lib/api";
import { prefs } from "../lib/prefs";
import { useLibrary } from "../lib/queries";
import { LEVELS, STANDARD_LIFTS, standing, type StandardsSet } from "../lib/standards";
import type { RecordRow, WeighIn } from "../lib/types";
import { weight, type WeightUnit } from "../lib/units";
import { dailySeries } from "../lib/weight";

/**
 * Where the big four sit against published strength standards, at your
 * current bodyweight. Off until the person picks a table, private, and framed
 * as a rough guide - the levels are about the bar, never about the scale.
 */
export function Standards({ records, unit }: { records: RecordRow[]; unit: WeightUnit }) {
  const [set, setSet] = useState<StandardsSet | null>(prefs.standards());
  const lib = useLibrary();
  const weighs = useQuery({ queryKey: ["weigh-ins", 60], queryFn: () => api<WeighIn[]>("/weigh-ins?days=60"), enabled: set !== null });
  const series = dailySeries(weighs.data ?? []);
  const bodyweight = series.length ? series[series.length - 1].avg : null;
  const choose = (v: StandardsSet | null) => {
    prefs.setStandards(v);
    setSet(v);
  };

  if (set === null) {
    return (
      <div className="card p-4 text-sm">
        <p className="text-muted">
          See roughly where your squat, bench, deadlift and overhead press sit against common strength standards? It uses your recent weigh-ins, and nobody else sees it.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => choose("men")}>
            Men's tables
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => choose("women")}>
            Women's tables
          </button>
        </div>
      </div>
    );
  }

  const rows = STANDARD_LIFTS.map((id) => {
    const best = records.find((r) => r.kind === "e1rm" && r.subject === id);
    return { id, name: lib?.byId.get(id)?.name ?? id, best, s: best && bodyweight ? standing(id, best.value, bodyweight, set) : null };
  });

  return (
    <div className="card p-4">
      {!bodyweight ? (
        <p className="text-sm text-muted">
          Standards compare with bodyweight. <Link to="/body" className="underline">Weigh in</Link> and they'll show here.
        </p>
      ) : (
        <ul className="space-y-4">
          {rows.map(({ id, name, best, s }) => (
            <li key={id}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium">{name}</span>
                <span className="num text-dim">{best ? `${weight(best.value, unit)} · ${s?.ratio.toFixed(2)}× bodyweight` : "Not logged yet"}</span>
              </div>
              {s && (
                <>
                  <div className="mt-1.5 grid grid-cols-5 gap-1" aria-hidden>
                    {LEVELS.map((l, i) => {
                      const reached = s.level != null && LEVELS.indexOf(s.level) >= i;
                      const current = s.next?.level === l;
                      return (
                        <span key={l} className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                          {(reached || current) && <span className="block h-full rounded-full bg-accent" style={{ width: reached ? "100%" : `${s.within * 100}%` }} />}
                        </span>
                      );
                    })}
                  </div>
                  <p className="mt-1 text-xs text-dim">
                    {s.level ?? "Below beginner"}
                    {s.next ? ` · ${s.next.level} at about ${weight(s.next.kg, unit)}` : " · the top of the table"}
                  </p>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs text-dim">
        A rough guide from widely published tables for estimated one-rep maxes. Age, height and training history all matter more than any table.{" "}
        <button type="button" className="underline" onClick={() => choose(set === "men" ? "women" : "men")}>
          Use {set === "men" ? "women's" : "men's"} tables
        </button>{" "}
        ·{" "}
        <button type="button" className="underline" onClick={() => choose(null)}>
          Hide
        </button>
      </p>
    </div>
  );
}
