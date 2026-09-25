import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { Trophy } from "../../components/phosphor";
import { Empty, ErrorState, Loading, PageHeader, Section } from "../../components/ui";
import { api } from "../../lib/api";
import { fmtMonthDay } from "../../lib/dates";
import { useMe } from "../../lib/session";
import type { RecordRow } from "../../lib/types";
import { clock, distance, weight } from "../../lib/units";

export function formatRecord(r: RecordRow, wu: "kg" | "lb", du: "km" | "mi") {
  if (r.kind === "e1rm") return weight(r.value, wu);
  if (r.kind === "reps") return `${r.value} reps`;
  if (r.kind === "hold") return clock(r.value);
  if (r.kind === "distance") return distance(r.value, du);
  if (r.kind.startsWith("pace")) return `${clock(du === "km" ? r.value : r.value * 1.609344)} /${du}`;
  return String(r.value);
}

const GROUPS: [string, (r: RecordRow) => boolean][] = [
  ["Strength", (r) => r.kind === "e1rm"],
  ["Bodyweight", (r) => r.kind === "reps" || r.kind === "hold"],
  ["Endurance", (r) => r.kind === "distance" || r.kind.startsWith("pace")],
];

export default function Records() {
  const me = useMe();
  const q = useQuery({ queryKey: ["records"], queryFn: () => api<{ current: RecordRow[]; recent: RecordRow[] }>("/me/records") });
  const wu = me.profile.weight_unit;
  const du = me.profile.distance_unit;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  return (
    <div>
      <PageHeader title="Personal records" back="/progress" subtitle="Yours against yours. Nobody else's numbers are involved." />
      {!q.data ? (
        <Loading />
      ) : q.data.current.length === 0 ? (
        <Empty icon={<Trophy size={26} />} title="No records yet" body="Log a few sessions with weights, reps or distance and your bests show up here." />
      ) : (
        <>
          {q.data.recent.length > 0 && (
            <Section title="Recently beaten">
              <ul className="card divide-y divide-line">
                {q.data.recent.slice(0, 8).map((r) => (
                  <li key={`${r.key}${r.date}`} className="flex items-center gap-3 px-4 py-3">
                    <Trophy size={18} weight="fill" className={r.rewarded ? "text-accent-text" : "text-dim"} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{r.label}</span>
                      <span className="block text-sm text-dim">
                        {fmtMonthDay(r.date)}
                        {r.flagged ? " · a big jump, kept but not scored" : ""}
                      </span>
                    </span>
                    <span className="num text-right text-sm">
                      <span className="block font-semibold">{formatRecord(r, wu, du)}</span>
                      {r.gain_pct != null && <span className="text-accent-text">+{r.gain_pct.toFixed(1)}%</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
          {GROUPS.map(([title, test]) => {
            const rows = q.data!.current.filter(test);
            if (!rows.length) return null;
            return (
              <Section key={title} title={title}>
                <ul className="card divide-y divide-line">
                  {rows.map((r) => (
                    <li key={r.key}>
                      <Link to={`/records/history?key=${encodeURIComponent(r.key)}`} className="press flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-2/60">
                        <span className="min-w-0">
                          <span className="block truncate">{r.label.replace(/ · estimated 1RM| · most reps| · longest hold/, "")}</span>
                          <span className="block text-sm text-dim">
                            {r.kind === "e1rm" ? "Estimated 1RM · " : ""}
                            {fmtMonthDay(r.date)}
                          </span>
                        </span>
                        <span className="num shrink-0 font-semibold">{formatRecord(r, wu, du)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Section>
            );
          })}
          <p className="mt-6 text-sm text-dim">Estimated 1RM uses the Epley formula on sets of 12 reps or fewer. Jumps of more than 15% are recorded but don't count as a scored PR, in case of a typo.</p>
        </>
      )}
    </div>
  );
}
