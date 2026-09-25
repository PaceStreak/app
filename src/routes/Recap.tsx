import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router";
import { CalendarBlank, CaretLeft, CaretRight, Medal, Trophy } from "../components/phosphor";
import { WeekDots } from "../components/WeekDots";
import { Empty, ErrorState, Loading, PageHeader, Section, Stat } from "../components/ui";
import { ApiError, api } from "../lib/api";
import { addDays, fmtMonthDay, localToday, weekStart } from "../lib/dates";
import { useMe } from "../lib/session";
import type { Recap as RecapData } from "../lib/types";

/**
 * One week, summed up - the screen the Monday digest opens. Attendance only:
 * days against the target, the verdict, the streak, records against your own
 * history, badges. No tonnage, no distance totals, no calories, for the same
 * reason there is no leaderboard for them.
 */
export default function Recap() {
  const me = useMe();
  const [params, setParams] = useSearchParams();
  const today = localToday(me.profile.timezone);
  const thisWeek = weekStart(today, me.profile.week_starts_on);
  const week = weekStart(params.get("week") ?? addDays(thisWeek, -7), me.profile.week_starts_on);
  const q = useQuery({
    queryKey: ["recap", week],
    queryFn: () => api<RecapData>(`/me/recap?week=${week}`),
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 2,
  });
  const go = (w: string) => setParams({ week: w }, { replace: true });
  const canNext = addDays(week, 7) <= thisWeek;
  const title = week === thisWeek ? "This week" : week === addDays(thisWeek, -7) ? "Last week" : `Week of ${fmtMonthDay(week)}`;

  return (
    <div>
      <PageHeader
        title={title}
        back="/progress"
        subtitle={`${fmtMonthDay(week)} to ${fmtMonthDay(addDays(week, 6))}`}
        action={
          <div className="flex gap-1">
            <button type="button" className="btn btn-ghost btn-icon" aria-label="Previous week" onClick={() => go(addDays(week, -7))}>
              <CaretLeft size={20} />
            </button>
            <button type="button" className="btn btn-ghost btn-icon" aria-label="Next week" disabled={!canNext} onClick={() => go(addDays(week, 7))}>
              <CaretRight size={20} />
            </button>
          </div>
        }
      />
      {q.isError ? (
        q.error instanceof ApiError && q.error.status === 404 ? (
          <Empty icon={<CalendarBlank size={26} />} title="Nothing that week" body="No sessions and no streak yet. Pick another week, or log one." />
        ) : (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        )
      ) : !q.data ? (
        <Loading rows={4} />
      ) : (
        <RecapBody recap={q.data} today={today} />
      )}
    </div>
  );
}

function RecapBody({ recap, today }: { recap: RecapData; today: string }) {
  const trend =
    recap.previous_days === null
      ? null
      : recap.days > recap.previous_days
        ? `${recap.days - recap.previous_days} more day${recap.days - recap.previous_days === 1 ? "" : "s"} than the week before`
        : recap.days < recap.previous_days
          ? `${recap.previous_days - recap.days} fewer than the week before, which is fine`
          : "Same as the week before";
  return (
    <>
      <div className="card p-5">
        <p className={`text-sm font-semibold ${recap.status === "kept" ? "text-accent" : "text-muted"}`}>{recap.verdict}</p>
        <p className="num mt-2 text-4xl font-semibold tracking-tight">
          {recap.days}
          <span className="text-lg font-normal text-dim"> of {recap.target} days</span>
        </p>
        <div className="mt-4">
          <WeekDots
            dots={Array.from({ length: 7 }, (_, i) => {
              const date = addDays(recap.week_start, i);
              return { date, trained: recap.trained_on.includes(date), today: date === today, future: date > today };
            })}
          />
        </div>
        {trend && <p className="mt-3 text-sm text-dim">{trend}</p>}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Stat label="Sessions" value={recap.sessions} />
        <Stat label="Streak" value={`${recap.streak} wk`} sub={`best ${recap.longest}`} />
        <Stat label="Freezes" value={recap.freezes_available} />
      </div>

      {recap.disciplines.length > 0 && (
        <Section title="What you did">
          <ul className="card divide-y divide-line">
            {recap.disciplines.map((d) => (
              <li key={d.id} className="flex items-center justify-between px-4 py-3">
                <span>{d.name}</span>
                <span className="num text-dim">{d.sessions}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(recap.records.length > 0 || recap.badges.length > 0) && (
        <Section title="New this week">
          <ul className="card divide-y divide-line">
            {recap.records.map((r) => (
              <li key={`${r.label}-${r.day}`} className="flex items-center gap-3 px-4 py-3">
                <Trophy size={18} className="text-accent" />
                <span className="flex-1">{r.label}</span>
                <span className="text-sm text-dim">{fmtMonthDay(r.day)}</span>
              </li>
            ))}
            {recap.badges.map((b) => (
              <li key={b.id} className="flex items-center gap-3 px-4 py-3">
                <Medal size={18} className="text-accent" />
                <span className="flex-1">{b.title}</span>
                {b.tier && <span className="text-sm text-dim capitalize">{b.tier}</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <p className="mt-8 text-center text-sm text-dim">
        This week's target is {recap.this_week_target}.{" "}
        <Link to="/log" className="text-accent">
          Log a session
        </Link>
      </p>
    </>
  );
}
