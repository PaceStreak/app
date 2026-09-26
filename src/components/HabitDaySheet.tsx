import { useEffect, useState } from "react";
import { fmtFullDay, relativeDay } from "../lib/dates";
import { isDone, setHabitDay, stepFor } from "../lib/habits";
import { parseNumber } from "../lib/units";
import type { Habit } from "../lib/types";
import { Check, Minus, Plus } from "./phosphor";
import { Sheet } from "./Sheet";
import { toast } from "./toast";

/**
 * Setting one day of a habit: big − and + around the amount, a few one-tap
 * amounts, and a field for anything else. The same sheet opens from a row,
 * the week strip and the calendar, so logging works the same everywhere.
 * A check habit never needs it: a tap is enough.
 */
export function HabitDaySheet({ habit, day, today, onClose }: { habit: Habit; day: string | null; today: string; onClose: () => void }) {
  const current = day ? amountOn(habit, day, today) : 0;
  const [value, setValue] = useState(current);
  const [typed, setTyped] = useState("");
  useEffect(() => {
    setValue(current);
    setTyped("");
  }, [day]); // eslint-disable-line react-hooks/exhaustive-deps

  const step = stepFor(habit);
  const goal = habit.daily_goal ?? 1;
  const unit = habit.kind === "duration" ? "min" : habit.kind === "quit" ? (value === 1 ? "slip" : "slips") : (habit.unit ?? "");
  const presets =
    habit.kind === "quit"
      ? []
      : [...new Set([step, step * 2, habit.kind === "duration" ? 30 : step * 5, goal])].filter((n) => n > 0).sort((a, b) => a - b).slice(0, 4);

  const commit = async (amount: number) => {
    if (!day) return;
    onClose();
    try {
      const result = await setHabitDay(habit, day, Math.max(0, Math.round(amount * 100) / 100), today);
      if (result === "queued") toast("Saved on this phone. It syncs when you're back online.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That didn't save");
    }
  };
  const bump = (n: number) => {
    setTyped("");
    setValue((v) => Math.max(0, Math.round((v + n) * 100) / 100));
  };
  const final = typed ? (parseNumber(typed) ?? value) : value;
  const pct = habit.kind === "quit" ? 0 : Math.min(100, (final / goal) * 100);

  return (
    <Sheet
      open={day !== null}
      onClose={onClose}
      title={day ? `${habit.emoji} ${habit.name}` : ""}
      footer={
        <div className="flex w-full gap-2">
          {current > 0 && (
            <button type="button" className="btn btn-ghost text-dim" onClick={() => void commit(0)}>
              Clear
            </button>
          )}
          <button type="button" className="btn btn-primary flex-1" onClick={() => void commit(final)}>
            <Check size={18} weight="bold" /> Save
          </button>
        </div>
      }
    >
      {day && (
        <div className="space-y-5">
          <p className="text-sm text-dim">{day === today ? "Today" : `${relativeDay(day, today)} · ${fmtFullDay(day)}`}</p>
          <div className="flex items-center justify-between gap-3">
            <button type="button" className="press grid size-14 shrink-0 place-items-center rounded-2xl bg-surface-2" aria-label={`Take ${step} off`} disabled={final <= 0} onClick={() => bump(-(habit.kind === "quit" ? 1 : step))}>
              <Minus size={22} weight="bold" />
            </button>
            <div className="min-w-0 text-center">
              <p className="num text-5xl font-semibold tracking-tight" aria-live="polite">{fmtAmount(final)}</p>
              <p className="mt-1 text-sm text-dim">
                {habit.kind === "quit" ? unit : `of ${fmtAmount(goal)} ${unit}`.trim()}
              </p>
            </div>
            <button type="button" className="press grid size-14 shrink-0 place-items-center rounded-2xl bg-accent text-accent-ink" aria-label={`Add ${step}`} onClick={() => bump(habit.kind === "quit" ? 1 : step)}>
              <Plus size={22} weight="bold" />
            </button>
          </div>
          {habit.kind !== "quit" && (
            <div className="h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
              <div className={`h-full rounded-full transition-[width] ${isDone(habit, final) ? "bg-accent" : "bg-accent/60"}`} style={{ width: `${pct}%` }} />
            </div>
          )}
          {presets.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {presets.map((n) => (
                <button key={n} type="button" className="chip press h-9 px-3" onClick={() => bump(n)}>
                  +{fmtAmount(n)} {unit}
                </button>
              ))}
              {final < goal && (
                <button type="button" className="chip chip-accent press h-9 px-3" onClick={() => { setTyped(""); setValue(goal); }}>
                  Hit the goal
                </button>
              )}
            </div>
          )}
          <div>
            <label className="field-label" htmlFor="habit-day-amount">Or type an amount</label>
            <input id="habit-day-amount" className="input num" inputMode="decimal" placeholder={fmtAmount(value)} value={typed} onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void commit(final)} />
          </div>
          {habit.kind === "quit" && <p className="field-hint">Zero is a clean day. A slip is logged, not punished.</p>}
        </div>
      )}
    </Sheet>
  );
}

export function amountOn(habit: Habit, day: string, today: string): number {
  if (day === today) return habit.today.amount;
  return habit.days?.find((d) => d.date === day)?.amount ?? habit.recent?.find((d) => d.date === day)?.amount ?? 0;
}

const fmtAmount = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
