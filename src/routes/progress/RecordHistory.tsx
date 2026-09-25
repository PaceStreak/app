import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router";
import { BarChart } from "../../components/BarChart";
import { ArrowRight, Trophy } from "../../components/phosphor";
import { Empty, ErrorState, Loading, PageHeader, Section } from "../../components/ui";
import { ApiError, api } from "../../lib/api";
import { fmtMonthDay } from "../../lib/dates";
import { useMe } from "../../lib/session";
import type { RecordRow } from "../../lib/types";
import { formatRecord } from "./Records";

interface Point {
  value: number;
  day: string | null;
  kind: "first" | "record" | "flagged";
  gain_pct?: number;
  workout_id?: string;
}

interface History {
  key: string;
  kind: string;
  subject: string;
  label: string;
  current: number;
  since: string;
  points: Point[];
}

/** Every time one record moved, oldest first: the story behind a number. */
export default function RecordHistory() {
  const me = useMe();
  const [params] = useSearchParams();
  const key = params.get("key") ?? "";
  const q = useQuery({
    queryKey: ["record-history", key],
    queryFn: () => api<History>(`/me/records/history?key=${encodeURIComponent(key)}`),
    enabled: !!key,
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 2,
  });
  const wu = me.profile.weight_unit;
  const du = me.profile.distance_unit;
  const show = (h: History, value: number) => formatRecord({ kind: h.kind, value } as RecordRow, wu, du);

  if (q.isError) {
    return q.error instanceof ApiError && q.error.status === 404 ? (
      <Empty icon={<Trophy size={26} />} title="No record here" body="It may have been removed along with the session that set it." />
    ) : (
      <ErrorState error={q.error} onRetry={() => void q.refetch()} />
    );
  }
  if (!q.data) return <Loading />;
  const h = q.data;
  const exercise = ["e1rm", "reps", "hold"].includes(h.kind);
  const moves = h.points.filter((p) => p.kind !== "first");

  return (
    <div>
      <PageHeader title={h.label} back="/records" subtitle={`Current best since ${fmtMonthDay(h.since)}`} />
      <div className="card p-5">
        <p className="text-sm text-dim">Current best</p>
        <p className="num mt-1 text-4xl font-semibold tracking-tight">{show(h, h.current)}</p>
        {h.points.length > 1 && (
          <p className="mt-2 text-sm text-muted">
            From {show(h, h.points[0].value)} across {moves.length} improvement{moves.length === 1 ? "" : "s"}.
          </p>
        )}
      </div>

      {h.points.length > 1 && (
        <Section title="How it moved">
          <div className="card p-4">
            <BarChart
              title={`${h.label}, each time it improved`}
              axisLabels={false}
              bars={h.points.map((p, i) => ({
                key: `${i}`,
                label: p.day ? fmtMonthDay(p.day) : "First",
                value: h.kind.startsWith("pace") ? 1 / p.value : p.value,
                display: show(h, p.value),
                dim: p.kind === "flagged",
              }))}
            />
          </div>
        </Section>
      )}

      <Section title="Timeline">
        <ol className="card divide-y divide-line">
          {[...h.points].reverse().map((p, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-3">
              <Trophy size={18} weight={p.kind === "record" ? "fill" : "regular"} className={p.kind === "record" ? "text-accent-text" : "text-dim"} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="num block font-semibold">{show(h, p.value)}</span>
                <span className="block text-sm text-dim">
                  {p.kind === "first" ? "Where it started" : fmtMonthDay(p.day!)}
                  {p.kind === "flagged" && " · a big jump, kept but not scored"}
                </span>
              </span>
              {p.gain_pct != null && <span className="num text-sm text-accent-text">+{p.gain_pct.toFixed(1)}%</span>}
              {p.workout_id && (
                <Link to={`/workouts/${p.workout_id}`} className="btn btn-ghost btn-icon btn-sm" aria-label="Open that session">
                  <ArrowRight size={16} />
                </Link>
              )}
            </li>
          ))}
        </ol>
      </Section>

      {exercise && (
        <Link to={`/exercises/${h.subject}`} className="btn btn-secondary mt-6 w-full">
          All history for this exercise
        </Link>
      )}
    </div>
  );
}
