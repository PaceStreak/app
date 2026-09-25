import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import { BarChart } from "../components/BarChart";
import { CalendarBlank, CaretLeft, CaretRight, Fire, Medal, Trophy } from "../components/phosphor";
import { Empty, ErrorState, Loading, PageHeader, Section, Stat } from "../components/ui";
import { ApiError, api } from "../lib/api";
import { fmtMonthDay } from "../lib/dates";
import { useMe } from "../lib/session";
import { plural } from "../lib/units";

interface YearReview {
  year: number;
  complete: boolean;
  first_day: string;
  days_trained: number;
  sessions: number;
  weeks_kept: number;
  weeks_closed: number;
  weeks_paused: number;
  consistency: number;
  longest_streak: number;
  best_month: { month: string; days: number };
  favourite_weekday: string;
  months: { month: string; days: number }[];
  disciplines: { id: string; name: string; sessions: number }[];
  records_count: number;
  top_records: { label: string; gain_pct: number; day: string }[];
  badges: { id: string; title: string; tier: string | null }[];
  milestones: { weeks: number; week_start: string }[];
}

/**
 * A year, summed up. Same rules as the weekly recap: attendance, not volume.
 * Weeks kept, days shown up, records against your own history - never
 * tonnage, total distance or calories.
 */
export default function Review() {
  const me = useMe();
  const [params, setParams] = useSearchParams();
  const thisYear = Number(new Intl.DateTimeFormat("en-CA", { timeZone: me.profile.timezone, year: "numeric" }).format(new Date()));
  const asked = Number(params.get("year")) || null;
  const q = useQuery({
    queryKey: ["review", asked],
    queryFn: () => api<YearReview>(`/me/review${asked ? `?year=${asked}` : ""}`),
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 2,
  });
  const year = q.data?.year ?? asked ?? thisYear;
  const go = (y: number) => setParams({ year: String(y) }, { replace: true });

  return (
    <div>
      <PageHeader
        title={`${year} in review`}
        back="/progress"
        subtitle={q.data && !q.data.complete ? "So far this year" : undefined}
        action={
          <div className="flex gap-1">
            <button type="button" className="btn btn-ghost btn-icon" aria-label="Previous year" onClick={() => go(year - 1)}>
              <CaretLeft size={20} />
            </button>
            <button type="button" className="btn btn-ghost btn-icon" aria-label="Next year" disabled={year >= thisYear} onClick={() => go(year + 1)}>
              <CaretRight size={20} />
            </button>
          </div>
        }
      />
      {q.isError ? (
        q.error instanceof ApiError && q.error.status === 404 ? (
          <Empty icon={<CalendarBlank size={26} />} title={`Nothing logged in ${year}`} body="Pick another year, or start this one." />
        ) : (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        )
      ) : !q.data ? (
        <Loading rows={5} />
      ) : (
        <ReviewBody r={q.data} />
      )}
    </div>
  );
}

function ReviewBody({ r }: { r: YearReview }) {
  const keptShare = r.weeks_closed ? Math.round((r.weeks_kept / (r.weeks_closed - r.weeks_paused || 1)) * 100) : 0;
  return (
    <>
      <div className="card p-5">
        <p className="text-sm font-semibold text-accent-text">Since {fmtMonthDay(r.first_day)}</p>
        <p className="num mt-2 text-5xl font-semibold tracking-tight">
          {r.days_trained}
          <span className="text-lg font-normal text-dim"> days you showed up</span>
        </p>
        <p className="mt-3 text-muted">
          {r.weeks_kept} of {r.weeks_closed - r.weeks_paused} weeks kept ({keptShare}%)
          {r.weeks_paused > 0 && `, and ${r.weeks_paused} paused to rest or recover`}.
        </p>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Stat label="Longest streak" value={`${r.longest_streak} wk`} />
        <Stat label="Consistency" value={`${r.consistency}%`} />
        <Stat label="Sessions" value={r.sessions} />
      </div>

      <Section title="Month by month">
        <div className="card p-4">
          <BarChart
            title={`Days trained per month in ${r.year}`}
            bars={r.months.map((m) => ({ key: m.month, label: m.month, value: m.days, display: `${m.days} day${m.days === 1 ? "" : "s"}` }))}
          />
          <p className="mt-2 text-sm text-dim">
            Best month: {r.best_month.month}, {plural(r.best_month.days, "day")}. Your most common training day was {r.favourite_weekday}.
          </p>
        </div>
      </Section>

      {r.disciplines.length > 0 && (
        <Section title="What you did">
          <ul className="card divide-y divide-line">
            {r.disciplines.map((d) => (
              <li key={d.id} className="flex items-center justify-between px-4 py-3">
                <span>{d.name}</span>
                <span className="num text-dim">
                  {d.sessions} session{d.sessions === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(r.milestones.length > 0 || r.records_count > 0 || r.badges.length > 0) && (
        <Section title="Highlights">
          <ul className="card divide-y divide-line">
            {r.milestones.map((m) => (
              <li key={m.week_start} className="flex items-center gap-3 px-4 py-3">
                <Fire size={18} weight="fill" className="text-flame" aria-hidden />
                <span className="flex-1">{m.weeks}-week streak</span>
                <span className="text-sm text-dim">{fmtMonthDay(m.week_start)}</span>
              </li>
            ))}
            {r.top_records.map((p) => (
              <li key={`${p.label}${p.day}`} className="flex items-center gap-3 px-4 py-3">
                <Trophy size={18} weight="fill" className="text-accent-text" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{p.label}</span>
                <span className="num text-sm text-accent-text">+{p.gain_pct.toFixed(1)}%</span>
              </li>
            ))}
            {r.badges.map((b) => (
              <li key={b.id} className="flex items-center gap-3 px-4 py-3">
                <Medal size={18} weight="fill" className="text-accent-text" aria-hidden />
                <span className="flex-1">{b.title}</span>
                {b.tier && <span className="text-sm text-dim capitalize">{b.tier}</span>}
              </li>
            ))}
          </ul>
          {r.records_count > r.top_records.length && <p className="field-hint">{r.records_count} personal records in all. The biggest jumps are shown.</p>}
        </Section>
      )}

      <p className="mt-8 text-center text-sm text-dim">Attendance, not volume. The weeks you kept are the whole story.</p>
    </>
  );
}
