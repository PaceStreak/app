import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { DisciplineIcon } from "../components/icons";
import { CalendarBlank } from "../components/phosphor";
import { Empty, PageHeader } from "../components/ui";
import { WorkoutRow } from "../components/WorkoutRow";
import { addDays, fmtMonthDay, localToday, weekStart } from "../lib/dates";
import { useLibrary, useStats, useWorkouts } from "../lib/queries";
import { useMe } from "../lib/session";
import { useLog } from "../shell/LogContext";

export default function History() {
  const me = useMe();
  const lib = useLibrary();
  const stats = useStats();
  const workouts = useWorkouts();
  const { openLog } = useLog();
  const [params, setParams] = useSearchParams();
  const filter = params.get("filter");
  const [shown, setShown] = useState(60);
  const today = stats.data?.today ?? localToday(me.profile.timezone);
  const cells = new Map((stats.data?.chains[0]?.weeks ?? []).map((w) => [w.week_start, w]));

  const disciplines = useMemo(() => [...new Set((workouts ?? []).map((w) => w.discipline))], [workouts]);
  const rows = useMemo(
    () => (workouts ?? []).filter((w) => (filter === "unsaved" ? w._error : !filter || w.discipline === filter)),
    [workouts, filter],
  );

  const groups = useMemo(() => {
    const out: { week: string; items: typeof rows }[] = [];
    for (const w of rows.slice(0, shown)) {
      const wk = weekStart(w.local_date, me.profile.week_starts_on);
      const last = out[out.length - 1];
      if (last?.week === wk) last.items.push(w);
      else out.push({ week: wk, items: [w] });
    }
    return out;
  }, [rows, shown, me.profile.week_starts_on]);

  const thisWeek = weekStart(today, me.profile.week_starts_on);
  const label = (wk: string) =>
    wk === thisWeek ? "This week" : wk === addDays(thisWeek, -7) ? "Last week" : `${fmtMonthDay(wk)} to ${fmtMonthDay(addDays(wk, 6))}`;

  return (
    <div>
      <PageHeader title="Sessions" subtitle={workouts ? `${workouts.length} logged` : undefined} back="/you" />
      {disciplines.length > 1 && (
        <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
          <button type="button" className={`chip h-9 px-3.5 ${!filter ? "chip-accent" : ""}`} onClick={() => setParams({})}>
            All
          </button>
          {disciplines.map((d) => (
            <button key={d} type="button" className={`chip h-9 px-3.5 ${filter === d ? "chip-accent" : ""}`} onClick={() => setParams(filter === d ? {} : { filter: d })}>
              <DisciplineIcon id={d} size={16} /> {lib?.discipline(d)?.name ?? d}
            </button>
          ))}
        </div>
      )}

      {workouts && rows.length === 0 ? (
        <Empty
          icon={<CalendarBlank size={26} />}
          title={filter ? "Nothing here" : "No sessions yet"}
          body={filter ? "Nothing matches this filter." : "Your first one takes ten seconds."}
          action={
            !filter && (
              <button type="button" className="btn btn-primary" onClick={() => openLog()}>
                Log a session
              </button>
            )
          }
        />
      ) : (
        <div className="space-y-6">
          {groups.map((g) => {
            const cell = cells.get(g.week);
            const days = new Set(g.items.map((w) => w.local_date)).size;
            return (
              <section key={g.week}>
                <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
                  <h2 className="font-semibold">{label(g.week)}</h2>
                  {cell && (
                    <span className={`chip h-6 ${cell.status === "kept" ? "chip-accent" : cell.status === "missed" ? "" : cell.status === "open" ? "" : "chip-flame"}`}>
                      {cell.status === "open" ? `${Math.max(days, cell.days)} of ${cell.target}` : cell.status === "kept" ? "Kept" : cell.status === "frozen" ? "Frozen" : cell.status === "repaired" ? "Repaired" : `${cell.days} of ${cell.target}`}
                    </span>
                  )}
                </div>
                <div className="card divide-y divide-line overflow-hidden">
                  {g.items.map((w) => (
                    <WorkoutRow key={w.id} w={w} lib={lib} profile={me.profile} today={today} />
                  ))}
                </div>
              </section>
            );
          })}
          {rows.length > shown && (
            <button type="button" className="btn btn-secondary w-full" onClick={() => setShown(shown + 60)}>
              Show more
            </button>
          )}
        </div>
      )}
    </div>
  );
}
