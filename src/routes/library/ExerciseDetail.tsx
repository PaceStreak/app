import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { BarChart } from "../../components/BarChart";
import { CustomExerciseForm } from "../../components/CustomExerciseForm";
import { PencilSimple, Trophy } from "../../components/phosphor";
import { ErrorState, PageHeader, Section } from "../../components/ui";
import { api } from "../../lib/api";
import { fmtMonthDay } from "../../lib/dates";
import { useLibrary } from "../../lib/queries";
import { useMe } from "../../lib/session";
import { fromKg, weight } from "../../lib/units";
import { pctChange, signed } from "../../lib/weight";

interface History {
  sessions: { workout_id: string; date: string; sets: { kind: string; weight_kg: number | null; reps: number | null; rpe: number | null; duration_sec: number | null }[]; best_e1rm: number; volume_kg: number; top_weight_kg: number }[];
  records: { key: string; value: number; previous: number | null; gain_pct: number | null; date: string; current: boolean; flagged: boolean }[];
}

export default function ExerciseDetail() {
  const { id = "" } = useParams();
  const me = useMe();
  const lib = useLibrary();
  const [editing, setEditing] = useState(false);
  const e = lib?.byId.get(id);
  const wu = me.profile.weight_unit;
  const q = useQuery({ queryKey: ["exercise-history", id], queryFn: () => api<History>(`/exercises/${encodeURIComponent(id)}/history?limit=60`) });
  const trend = [...(q.data?.sessions ?? [])].reverse().filter((s) => s.best_e1rm > 0).slice(-20);
  const best = q.data?.records.find((r) => r.current && r.key.startsWith("e1rm"));

  return (
    <div>
      <PageHeader
        title={e?.name ?? "Exercise"}
        back
        subtitle={e ? `${lib?.lib.patterns[e.pattern] ?? e.pattern} · ${lib?.lib.equipment[e.equipment] ?? e.equipment}` : undefined}
        action={
          e?.custom && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>
              <PencilSimple size={16} /> Edit
            </button>
          )
        }
      />
      {e && (
        <div className="card p-4">
          {e.cue && <p className="text-[1.02rem]">{e.cue}</p>}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {e.primary.map((m) => (
              <span key={m} className="chip chip-accent">{lib?.lib.muscles[m]}</span>
            ))}
            {e.secondary.map((m) => (
              <span key={m} className="chip">{lib?.lib.muscles[m]}</span>
            ))}
          </div>
          <p className="mt-3 text-sm text-dim">Default rest {Math.round(e.rest_sec / 60 * 10) / 10} min{e.unilateral ? " · one side at a time" : ""}</p>
        </div>
      )}

      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : q.data && q.data.sessions.length === 0 ? (
        <p className="mt-8 text-center text-muted">You haven't logged this yet.</p>
      ) : (
        <>
          {best && (
            <Section title="Best">
              <div className="card flex items-center gap-4 p-4">
                <Trophy size={26} weight="fill" className="text-accent-text" />
                <div>
                  <p className="num text-2xl font-semibold tracking-tight">{weight(best.value, wu)}</p>
                  <p className="text-sm text-dim">Estimated 1RM · {fmtMonthDay(best.date)}</p>
                </div>
              </div>
            </Section>
          )}
          {trend.length > 1 && (
            <Section title="Estimated 1RM over time">
              <div className="card p-4">
                <div className="mb-4 grid grid-cols-3 gap-3">
                  {(
                    [
                      ["Est. 1RM", (x: (typeof trend)[number]) => x.best_e1rm],
                      ["Top set", (x: (typeof trend)[number]) => x.top_weight_kg],
                      ["Volume", (x: (typeof trend)[number]) => x.volume_kg],
                    ] as const
                  ).map(([label, pick]) => {
                    const pct = pctChange(pick(trend[0]), pick(trend[trend.length - 1]));
                    return (
                      <div key={label}>
                        <p className="text-sm text-dim">{label}</p>
                        <p className="num mt-0.5 text-lg font-semibold">{pct == null ? "–" : `${signed(pct)}%`}</p>
                      </div>
                    );
                  })}
                </div>
                <p className="-mt-2 mb-4 text-xs text-dim">
                  Change across these {trend.length} sessions, since {fmtMonthDay(trend[0].date)}.
                </p>
                <BarChart title="Estimated one-rep max by session" bars={trend.map((s) => ({ key: s.workout_id, label: fmtMonthDay(s.date), value: fromKg(s.best_e1rm, wu), display: weight(s.best_e1rm, wu) }))} />
              </div>
            </Section>
          )}
          <Section title="Sessions">
            <ul className="card divide-y divide-line">
              {(q.data?.sessions ?? []).slice(0, 30).map((s) => (
                <li key={s.workout_id}>
                  <Link to={`/workouts/${s.workout_id}`} className="press block px-4 py-3 hover:bg-surface-2/60">
                    <span className="text-sm text-dim">{fmtMonthDay(s.date)}</span>
                    <span className="num mt-0.5 block">
                      {s.sets
                        .filter((x) => x.kind !== "warmup")
                        .map((x) => (e?.load_type === "bodyweight" ? `${x.reps}` : e?.load_type === "time" ? `${x.duration_sec}s` : `${weight(x.weight_kg, wu, false)}×${x.reps}`))
                        .join("  ")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        </>
      )}
      {e?.custom && <CustomExerciseForm open={editing} existing={e} onClose={() => setEditing(false)} />}
    </div>
  );
}
