import { useMemo, useState } from "react";
import { Link } from "react-router";
import { addDays, fmtFullDay, parseDay, weekday, weekStart } from "../lib/dates";
import { isDone, markerFor, orderForToday, partOfDay, setHabitDay } from "../lib/habits";
import { haptic } from "../lib/prefs";
import { useHabitCatalog, useHabits } from "../lib/queries";
import { useMe } from "../lib/session";
import type { Habit } from "../lib/types";
import { AddHabit } from "./HabitForm";
import { HabitDaySheet } from "./HabitDaySheet";
import { MarkerRing, MarkerSlash, MarkerX } from "./Marker";
import { Plus } from "./phosphor";
import { toast } from "./toast";

const letter = new Intl.DateTimeFormat(undefined, { weekday: "narrow", timeZone: "UTC" });

/**
 * This week as a page of the wall calendar: one row per habit, seven date
 * boxes, today's column ringed in red. A tap crosses a box off in marker;
 * an amount or a slip opens the day sheet. With no habits yet, one quiet
 * invitation rather than a list of defaults nobody chose.
 */
export function HabitsToday({ today }: { today: string }) {
  const me = useMe();
  const habits = useHabits();
  const catalog = useHabitCatalog();
  const [adding, setAdding] = useState(false);
  const [sheet, setSheet] = useState<{ habit: Habit; day: string } | null>(null);
  const ordered = useMemo(() => orderForToday(habits.data ?? [], partOfDay(new Date().getHours())), [habits.data]);
  if (!habits.data) return null;
  const doing = ordered.filter((h) => h.kind !== "quit");
  const done = doing.filter((h) => h.today.done).length;
  const start = weekStart(today, me.profile.week_starts_on);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  // Grouped by category when more than one is in use - one section per
  // category, in the order each first appears - so a full board of "other"
  // (the default) never grows a header nobody asked for.
  const categoryNames = catalog.data?.categories ?? {};
  const groups: { category: string; habits: Habit[] }[] = [];
  for (const h of ordered) {
    const group = groups.find((g) => g.category === h.category);
    if (group) group.habits.push(h);
    else groups.push({ category: h.category, habits: [h] });
  }
  const grouped = groups.length > 1;

  const tap = async (h: Habit, day: string, amount: number) => {
    if (day > today) return;
    if (h.kind !== "check") return setSheet({ habit: h, day });
    const next = amount > 0 ? 0 : 1;
    if (next) haptic([10, 30, 14]);
    try {
      const result = await setHabitDay(h, day, next, today);
      if (result === "queued") toast("Saved on this phone. It syncs when you're back online.");
      else if (next) toast.success(`${h.name}: crossed off`, { action: { label: "Add a note", onClick: () => setSheet({ habit: h, day }) }, duration: 5000 });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That didn't save");
    }
  };

  return (
    <section aria-labelledby="habits-today">
      <div className="mb-2.5 flex items-baseline justify-between">
        <h2 id="habits-today" className="text-[1.15rem] font-bold">
          This week
        </h2>
        {ordered.length > 0 && (
          <Link to="/habits" className="num text-sm font-semibold text-accent-text">
            {done} of {doing.length} today
          </Link>
        )}
      </div>
      {ordered.length === 0 ? (
        <button type="button" className="press card flex w-full items-center gap-3 p-4 text-left" onClick={() => setAdding(true)}>
          <span className="grid size-10 place-items-center rounded-md border border-dashed border-line-lit text-accent-text">
            <Plus size={20} />
          </span>
          <span>
            <span className="block font-semibold">Add a habit to the calendar</span>
            <span className="block text-sm text-dim">Reading, water, a language, meditation, or something you're giving up.</span>
          </span>
        </button>
      ) : (
        <div className="card overflow-hidden">
          <div className="board" role="grid" aria-label="This week's habits">
            {days.map((d) => (
              <div key={d} role="columnheader" className="board-day !h-auto flex-col py-1.5 text-[0.68rem] leading-tight" data-today={d === today} aria-label={fmtFullDay(d)}>
                <span className={`font-bold uppercase ${weekday(d) === 6 ? "text-accent-text" : ""}`}>{letter.format(parseDay(d))}</span>
                <span className="num text-[0.8rem]">{Number(d.slice(8))}</span>
              </div>
            ))}
            {grouped
              ? groups.map((g) => (
                  <div key={g.category} role="rowgroup" className="col-span-full [&:not(:first-child)]:border-t [&:not(:first-child)]:border-line">
                    <p className="board-name px-3 pt-2 pb-1 text-xs font-bold tracking-wide text-dim uppercase">{categoryNames[g.category] ?? g.category}</p>
                    <div className="board" role="grid" aria-label={`${categoryNames[g.category] ?? g.category} habits this week`}>
                      {g.habits.map((h) => (
                        <BoardRow key={h.id} habit={h} days={days} today={today} onTap={tap} />
                      ))}
                    </div>
                  </div>
                ))
              : ordered.map((h) => (
                  <BoardRow key={h.id} habit={h} days={days} today={today} onTap={tap} />
                ))}
          </div>
        </div>
      )}
      {sheet && <HabitDaySheet habit={sheet.habit} day={sheet.day} today={today} onClose={() => setSheet(null)} />}
      <AddHabit open={adding} onClose={() => setAdding(false)} />
    </section>
  );
}

function BoardRow({ habit: h, days, today, onTap }: { habit: Habit; days: string[]; today: string; onTap: (h: Habit, day: string, amount: number) => void }) {
  const amounts = new Map((h.recent ?? []).map((d) => [d.date, d.amount]));
  amounts.set(today, h.today.amount);
  const tone = markerFor(h.category);
  return (
    <>
      <Link to={`/habits/${h.id}`} role="rowheader" className="board-name press flex min-w-0 items-center gap-2 px-3 pt-2.5 pb-1.5">
        <span aria-hidden className="text-base leading-none">{h.emoji}</span>
        <span className="flex min-w-0 flex-1 items-baseline justify-between gap-3">
          <span className="truncate text-[0.95rem] font-semibold">{h.name}</span>
          <span className="num shrink-0 text-xs text-dim">
            {h.kind === "quit" ? `${h.clean_run ?? 0} clean` : `${h.streak.this_week_days}/${h.streak.this_week_target}${h.streak.current ? ` · ${h.streak.current} wk` : ""}`}
          </span>
        </span>
      </Link>
      {days.map((d) => {
        const future = d > today;
        const before = d < h.started_on;
        const amount = amounts.get(d) ?? 0;
        const ok = !future && !before && h.kind !== "quit" && isDone(h, amount);
        const partial = !ok && h.kind !== "quit" && amount > 0;
        const slipped = h.kind === "quit" && amount > 0;
        const clean = h.kind === "quit" && !future && !before && amount <= 0;
        const label = `${h.name}, ${fmtFullDay(d)}: ${slipped ? "slipped" : ok || clean ? "done" : partial ? "part done" : future ? "to come" : "not done"}`;
        return (
          <button key={d} type="button" className="board-day" data-today={d === today} data-future={future} data-partial={partial} disabled={future} aria-label={label} onClick={() => onTap(h, d, amount)}>
            <span className={ok || partial || slipped ? "opacity-35" : clean ? "text-ink" : ""}>{Number(d.slice(8))}</span>
            {ok && <MarkerX tone={tone} />}
            {partial && <MarkerSlash tone={tone} />}
            {slipped && <MarkerRing />}
          </button>
        );
      })}
    </>
  );
}
