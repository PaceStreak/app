import { useMemo, useState } from "react";
import { orderForToday, partOfDay } from "../lib/habits";
import { useHabits } from "../lib/queries";
import { AddHabit } from "./HabitForm";
import { HabitRow } from "./HabitRow";
import { Plus, Sparkle } from "./phosphor";

/**
 * What to do today, as a plain checklist. The week board below is a record;
 * this is the thing you actually use: one row per habit, one big tap target,
 * the unfinished ones first. Ticking the last one is the day's small win.
 */
export function TodayChecklist({ today, onLog }: { today: string; onLog: () => void }) {
  const habits = useHabits();
  const [adding, setAdding] = useState(false);
  const ordered = useMemo(() => orderForToday(habits.data ?? [], partOfDay(new Date().getHours())), [habits.data]);
  if (!habits.data) return null;

  const doing = ordered.filter((h) => h.kind !== "quit");
  const done = doing.filter((h) => h.today.done).length;
  const pct = doing.length ? Math.round((done / doing.length) * 100) : 0;

  if (ordered.length === 0) {
    return (
      <section className="card p-5 sm:p-6" aria-labelledby="today-list">
        <span className="grid size-11 place-items-center rounded-xl bg-accent-soft text-accent-text">
          <Sparkle size={22} weight="fill" />
        </span>
        <h2 id="today-list" className="mt-4 text-xl font-bold">
          Start with one habit
        </h2>
        <p className="mt-1.5 max-w-[46ch] text-muted">
          Reading, water, a language, a workout, or something you&apos;re giving up. Pick one and it shows up here every day.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
            <Plus size={18} weight="bold" /> Add a habit
          </button>
          <button type="button" className="btn btn-secondary" onClick={onLog}>
            Log a session instead
          </button>
        </div>
        <AddHabit open={adding} onClose={() => setAdding(false)} />
      </section>
    );
  }

  return (
    <section className="card overflow-hidden" aria-labelledby="today-list">
      <div className="flex items-center justify-between gap-4 px-4 pt-4 pb-3 sm:px-5">
        <div className="min-w-0">
          <h2 id="today-list" className="text-lg font-bold">
            Today
          </h2>
          <p className="num text-sm text-dim">
            {doing.length === 0 ? "Nothing to build today" : done === doing.length ? "All done. See you tomorrow." : `${done} of ${doing.length} done`}
          </p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAdding(true)}>
          <Plus size={16} weight="bold" /> Add
        </button>
      </div>
      {doing.length > 0 && (
        <div className="progress mx-4 mb-1 sm:mx-5" role="progressbar" aria-valuemin={0} aria-valuemax={doing.length} aria-valuenow={done} aria-label="Habits done today">
          <span style={{ width: `${pct}%` }} data-complete={done === doing.length} />
        </div>
      )}
      <div className="divide-y divide-line">
        {ordered.map((h) => (
          <HabitRow key={h.id} habit={h} today={today} strip={false} />
        ))}
      </div>
      <AddHabit open={adding} onClose={() => setAdding(false)} />
    </section>
  );
}
