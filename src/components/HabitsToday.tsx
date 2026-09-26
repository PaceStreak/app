import { useMemo, useState } from "react";
import { Link } from "react-router";
import { orderForToday, partOfDay } from "../lib/habits";
import { useHabits } from "../lib/queries";
import { AddHabit } from "./HabitForm";
import { HabitRow } from "./HabitRow";
import { Plus } from "./phosphor";

/**
 * Today's habits, the part of the day it is now first, each one tap from
 * done. With none yet, a single quiet invitation rather than a list of
 * defaults nobody chose.
 */
export function HabitsToday({ today }: { today: string }) {
  const habits = useHabits();
  const [adding, setAdding] = useState(false);
  const ordered = useMemo(() => orderForToday(habits.data ?? [], partOfDay(new Date().getHours())), [habits.data]);
  if (!habits.data) return null;
  const doing = ordered.filter((h) => h.kind !== "quit");
  const done = doing.filter((h) => h.today.done).length;

  return (
    <section className="mt-6" aria-labelledby="habits-today">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 id="habits-today" className="text-[1.05rem] font-semibold tracking-tight">
          Habits
        </h2>
        {ordered.length > 0 ? (
          <Link to="/habits" className="text-sm font-semibold text-accent-text">
            {done}/{doing.length} today
          </Link>
        ) : null}
      </div>
      {ordered.length === 0 ? (
        <button type="button" className="press card flex w-full items-center gap-3 p-4 text-left" onClick={() => setAdding(true)}>
          <span className="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent-text">
            <Plus size={20} />
          </span>
          <span>
            <span className="block font-semibold">Add a habit</span>
            <span className="block text-sm text-dim">Reading, water, a language, meditation, or something you're giving up.</span>
          </span>
        </button>
      ) : (
        <div className="card divide-y divide-line">
          {ordered.map((h) => (
            <HabitRow key={h.id} habit={h} today={today} />
          ))}
        </div>
      )}
      <AddHabit open={adding} onClose={() => setAdding(false)} />
    </section>
  );
}
