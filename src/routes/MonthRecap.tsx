import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router";
import { Barbell, CaretLeft, CaretRight } from "../components/phosphor";
import { Empty, ErrorState, Loading, PageHeader, Section, Stat } from "../components/ui";
import { ApiError, api } from "../lib/api";
import { localToday } from "../lib/dates";
import { useMe } from "../lib/session";
import type { MonthRecap as MonthData } from "../lib/types";
import { plural, weight } from "../lib/units";
import { signed } from "../lib/weight";

const monthName = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });

function shift(month: string, by: number): string {
  const d = new Date(`${month}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + by);
  return d.toISOString().slice(0, 7);
}

/**
 * A month of lifting against your own history: each main lift's best this
 * month next to its best before it. Like the weekly recap, no volume - the
 * point is getting a little better, not bigger totals.
 */
export default function MonthRecap() {
  const me = useMe();
  const wu = me.profile.weight_unit;
  const [params, setParams] = useSearchParams();
  const today = localToday(me.profile.timezone);
  const thisMonth = today.slice(0, 7);
  // Early in a month, last month is the one with something to say.
  const month = params.get("month") ?? (Number(today.slice(8)) > 7 ? thisMonth : shift(thisMonth, -1));
  const q = useQuery({
    queryKey: ["month-recap", month],
    queryFn: () => api<MonthData>(`/me/recap/month?month=${month}`),
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 2,
  });
  const go = (m: string) => setParams({ month: m }, { replace: true });
  const d = q.data;

  return (
    <div>
      <PageHeader
        title={monthName(month)}
        back="/progress"
        subtitle="Your lifts against your own history"
        action={
          <div className="flex gap-1">
            <button type="button" className="btn btn-ghost btn-icon" aria-label="Previous month" onClick={() => go(shift(month, -1))}>
              <CaretLeft size={20} />
            </button>
            <button type="button" className="btn btn-ghost btn-icon" aria-label="Next month" disabled={month >= thisMonth} onClick={() => go(shift(month, 1))}>
              <CaretRight size={20} />
            </button>
          </div>
        }
      />
      {q.isError && q.error instanceof ApiError && q.error.status === 404 ? (
        <Empty icon={<Barbell size={26} />} title="Nothing that month" body="Months with sessions get a recap." />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : !d ? (
        <Loading />
      ) : (
        <>
          <div className="card mt-4 grid grid-cols-3 gap-4 p-4">
            <Stat label="Days trained" value={d.active_days} />
            <Stat label="Weeks kept" value={`${d.weeks_kept}/${d.weeks}`} />
            <Stat label="Records" value={d.records} />
          </div>
          {!d.complete && <p className="mt-2 text-sm text-dim">The month isn't over yet; this is how it stands today.</p>}

          {d.lifts.length > 0 ? (
            <Section title="Main lifts">
              <ul className="card divide-y divide-line">
                {d.lifts.map((l) => (
                  <li key={l.exercise_id}>
                    <Link to={`/exercises/${encodeURIComponent(l.exercise_id)}`} className="press flex items-center gap-3 px-4 py-3">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{l.name}</span>
                        <span className="block text-sm text-dim">
                          {plural(l.sessions, "session")} · best {weight(l.best_e1rm, wu)} est. 1RM
                        </span>
                      </span>
                      <span className="num shrink-0 text-right text-sm">
                        {l.change_pct == null ? (
                          <span className="text-dim">First month</span>
                        ) : (
                          <>
                            <span className={`block font-semibold ${l.change_pct > 0 ? "text-accent-text" : ""}`}>{signed(l.change_pct)}%</span>
                            <span className="block text-xs text-dim">vs {weight(l.previous_best!, wu)}</span>
                          </>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-sm text-dim">Each lift's best estimated 1RM this month, against its best before the month began.</p>
            </Section>
          ) : (
            <p className="mt-6 text-muted">No weighted lifts this month. The days still count.</p>
          )}

          {(d.steadiest || d.pr_streak > 0) && (
            <Section title="Worth noticing">
              <ul className="card space-y-2 p-4 text-sm">
                {d.steadiest && <li>{d.steadiest} was your steadiest lift: the one you came back to most.</li>}
                {d.pr_streak > 0 && <li>A record in each of your last {plural(d.pr_streak, "four-week block")}.</li>}
              </ul>
            </Section>
          )}
        </>
      )}
    </div>
  );
}
