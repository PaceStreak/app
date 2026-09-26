import { useState } from "react";
import { Link } from "react-router";
import { haptic } from "../lib/prefs";
import { isDone, progressText, setHabitDay, stepFor } from "../lib/habits";
import type { Habit } from "../lib/types";
import { useConfirm } from "./Confirm";
import { Check, Fire, Minus, Plus } from "./phosphor";
import { toast } from "./toast";

/**
 * One habit, doable in one tap: a tick for a check, + for a count or
 * minutes, and for a habit being broken a quiet "I slipped" behind a
 * confirmation. The name links to its page.
 */
export function HabitRow({ habit, today }: { habit: Habit; today: string }) {
  const [confirmSheet, ask] = useConfirm();
  const [busy, setBusy] = useState(false);
  const amount = habit.today.amount;
  const done = isDone(habit, amount);

  const set = async (next: number) => {
    setBusy(true);
    try {
      const result = await setHabitDay(habit, today, Math.max(0, Math.round(next * 100) / 100), today);
      if (!isDone(habit, amount) && isDone(habit, next) && habit.kind !== "quit") haptic([10, 30, 14]);
      if (result === "queued") toast("Saved on this phone. It syncs when you're back online.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That didn't save");
    } finally {
      setBusy(false);
    }
  };

  const slip = async () => {
    if (
      !(await ask({
        title: "Log a slip for today?",
        body: "It happens. The streak is about most days, not perfect ones, and the clean-day count starts again from tomorrow.",
        confirm: "Log it",
      }))
    )
      return;
    await set(amount + 1);
  };

  const progress = progressText(habit, amount);
  const streakText =
    habit.kind === "quit"
      ? `${habit.clean_run ?? 0} ${habit.clean_run === 1 ? "day" : "days"} clean`
      : `${habit.streak.this_week_days}/${habit.streak.this_week_target} this week`;

  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${done && habit.kind !== "quit" ? "opacity-70" : ""}`}>
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-xl" aria-hidden>
        {habit.emoji}
      </span>
      <Link to={`/habits/${habit.id}`} className="min-w-0 flex-1">
        <span className={`block truncate font-medium ${done && habit.kind !== "quit" ? "line-through decoration-dim" : ""}`}>{habit.name}</span>
        <span className="num flex items-center gap-1.5 text-sm text-dim">
          {habit.streak.current > 0 && (
            <>
              <Fire size={13} weight="fill" className="text-flame" aria-hidden /> {habit.streak.current} wk ·
            </>
          )}{" "}
          {progress ?? streakText}
        </span>
      </Link>
      {habit.kind === "check" && (
        <button type="button" disabled={busy} className="set-check press" aria-pressed={done} aria-label={done ? `${habit.name}: done. Tap to undo.` : `Mark ${habit.name} done`} onClick={() => void set(done ? 0 : 1)}>
          <Check size={20} weight="bold" />
        </button>
      )}
      {(habit.kind === "count" || habit.kind === "duration") && (
        <div className="flex items-center gap-1">
          {amount > 0 && (
            <button type="button" disabled={busy} className="btn btn-ghost btn-icon btn-sm text-dim" aria-label={`Take ${stepFor(habit)} off ${habit.name}`} onClick={() => void set(amount - stepFor(habit))}>
              <Minus size={16} />
            </button>
          )}
          <button type="button" disabled={busy} className="set-check press" aria-pressed={done} aria-label={`Add ${stepFor(habit)} ${habit.kind === "duration" ? "minutes" : (habit.unit ?? "")} to ${habit.name}`} onClick={() => void set(amount + stepFor(habit))}>
            {done ? <Check size={20} weight="bold" /> : <Plus size={20} weight="bold" />}
          </button>
        </div>
      )}
      {habit.kind === "quit" && (
        <button type="button" disabled={busy} className="btn btn-ghost btn-sm text-dim" onClick={() => void slip()}>
          {amount > 0 ? `Slipped${amount > 1 ? ` ×${amount}` : ""}` : "I slipped"}
        </button>
      )}
      {confirmSheet}
    </div>
  );
}
