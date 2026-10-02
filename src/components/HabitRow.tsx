import { useState } from "react";
import { Link } from "react-router";
import { fmtFullDay, parseDay } from "../lib/dates";
import { useRowGestures } from "../lib/gestures";
import { haptic } from "../lib/prefs";
import { isDone, markerFor, progressText, setHabitDay, stepFor } from "../lib/habits";
import { MarkerRing, MarkerSlash, MarkerX } from "./Marker";
import type { Habit } from "../lib/types";
import { useConfirm } from "./Confirm";
import { HabitDaySheet } from "./HabitDaySheet";
import { Check, Fire, Plus } from "./phosphor";
import { toast } from "./toast";

const initial = new Intl.DateTimeFormat(undefined, { weekday: "narrow", timeZone: "UTC" });

/**
 * One habit, doable in one tap: a tick for a check, + for a count or
 * minutes, and for a habit being broken a quiet "I slipped" behind a
 * confirmation. Underneath, the last seven days: tap one to fill in a day
 * you forgot, without opening anything. For an amount, tapping the
 * progress opens a sheet to set it exactly.
 */
export function HabitRow({ habit, today, strip = true }: { habit: Habit; today: string; strip?: boolean }) {
  const [confirmSheet, ask] = useConfirm();
  const [busy, setBusy] = useState(false);
  const [sheetDay, setSheetDay] = useState<string | null>(null);
  const amount = habit.today.amount;
  const done = isDone(habit, amount);
  const measured = habit.kind === "count" || habit.kind === "duration";

  const set = async (day: string, next: number, was: number) => {
    setBusy(true);
    try {
      const result = await setHabitDay(habit, day, Math.max(0, Math.round(next * 100) / 100), today);
      const finished = !isDone(habit, was) && isDone(habit, next) && habit.kind !== "quit";
      if (finished) haptic([10, 30, 14]);
      if (result === "queued") toast("Saved on this phone. It syncs when you're back online.");
      else if (finished || (habit.kind === "quit" && next > was)) {
        toast.success(habit.kind === "quit" ? "Slip logged" : `${habit.name}: done`, { action: { label: "Add a note", onClick: () => setSheetDay(day) }, duration: 5000 });
      }
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
    await set(today, amount + 1, amount);
  };

  const tapDay = (day: string, dayAmount: number) => {
    if (habit.kind === "check") return void set(day, dayAmount > 0 ? 0 : 1, dayAmount);
    setSheetDay(day);
  };

  // Swipe right to complete, left or long-press for the exact amount (or a
  // note). Not for a habit being broken: a slip is never one stray swipe.
  const goal = habit.kind === "check" ? 1 : (habit.daily_goal ?? 1);
  const gestures = useRowGestures({
    disabled: busy || habit.kind === "quit",
    onSwipeRight: () => {
      if (!done) void set(today, Math.max(goal, amount), amount);
    },
    onSwipeLeft: () => setSheetDay(today),
    onLongPress: () => setSheetDay(today),
  });

  const progress = progressText(habit, amount);
  const streakText =
    habit.kind === "quit"
      ? `${habit.clean_run ?? 0} ${habit.clean_run === 1 ? "day" : "days"} clean`
      : `${habit.streak.this_week_days}/${habit.streak.this_week_target} this week`;
  const recent = (habit.recent ?? []).filter((d) => d.date >= habit.started_on);

  return (
    <div className="relative overflow-hidden">
      {gestures.dx !== 0 && (
        <div aria-hidden className={`absolute inset-0 flex items-center px-5 text-sm font-semibold ${gestures.dx > 0 ? "justify-start bg-accent text-accent-ink" : "justify-end bg-surface-3 text-ink"} ${gestures.armed ? "" : "opacity-70"}`}>
          {gestures.dx > 0 ? (done ? "Already done" : "Done") : "Set amount"}
        </div>
      )}
    <div className={`relative bg-surface px-4 py-3 ${gestures.dx === 0 ? "transition-transform duration-200 motion-reduce:transition-none" : ""}`} style={{ transform: gestures.dx ? `translateX(${gestures.dx}px)` : undefined, touchAction: "pan-y" }} {...gestures.handlers}>
      <div className="flex items-center gap-3">
        <Link to={`/habits/${habit.id}`} className="grid size-10 shrink-0 place-items-center text-xl" aria-hidden tabIndex={-1}>
          {habit.emoji}
        </Link>
        <div className="min-w-0 flex-1">
          <Link to={`/habits/${habit.id}`} className={`block truncate font-medium ${done && habit.kind !== "quit" ? "text-muted" : ""}`}>
            {habit.name}
          </Link>
          <span className="num flex items-center gap-1.5 text-sm text-dim">
            {habit.streak.current > 0 && (
              <>
                <Fire size={13} weight="fill" className="text-flame" aria-hidden /> {habit.streak.current} wk ·
              </>
            )}{" "}
            {measured ? (
              <button type="button" className="underline decoration-dotted underline-offset-4 hover:text-ink" onClick={() => setSheetDay(today)}>
                {progress}
              </button>
            ) : (
              streakText
            )}
          </span>
        </div>
        {habit.kind === "check" && (
          <button type="button" disabled={busy} className="set-check press size-11 shrink-0" aria-pressed={done} aria-label={done ? `${habit.name}: done. Tap to undo.` : `Mark ${habit.name} done`} onClick={() => void set(today, done ? 0 : 1, amount)}>
            <Check size={20} weight="bold" />
          </button>
        )}
        {measured && (
          <button
            type="button"
            disabled={busy}
            className="set-check press size-11 shrink-0"
            aria-pressed={done}
            aria-label={done ? `${habit.name}: goal met. Set the amount` : `Add ${stepFor(habit)} ${habit.kind === "duration" ? "minutes" : (habit.unit ?? "")} to ${habit.name}`}
            onClick={() => (done ? setSheetDay(today) : void set(today, amount + stepFor(habit), amount))}
          >
            {done ? <Check size={20} weight="bold" /> : <Plus size={20} weight="bold" />}
          </button>
        )}
        {habit.kind === "quit" && (
          <button type="button" disabled={busy} className="btn btn-ghost btn-sm shrink-0 text-dim" onClick={() => void slip()}>
            {amount > 0 ? `Slipped${amount > 1 ? ` ×${amount}` : ""}` : "I slipped"}
          </button>
        )}
      </div>
      {strip && recent.length > 1 && (
        <div className="mt-2.5 flex gap-1.5 pl-13" role="group" aria-label={`${habit.name}, the last seven days`}>
          {recent.map((d) => {
            const isToday = d.date === today;
            const ok = isDone(habit, d.amount);
            const slipped = habit.kind === "quit" && d.amount > 0;
            const partial = measured && d.amount > 0 && !ok;
            return (
              <button
                key={d.date}
                type="button"
                disabled={busy}
                onClick={() => tapDay(d.date, d.amount)}
                aria-label={`${fmtFullDay(d.date)}: ${slipped ? "slipped" : ok ? "done" : partial ? "partly done" : "not done"}${d.note ? ", has a note" : ""}`}
                className={`press relative flex h-8 max-w-10 flex-1 items-center justify-center rounded-sm border text-[0.72rem] font-semibold ${
                  isToday ? "border-accent text-accent-text" : "border-line text-dim"
                }`}
              >
                <span className={ok && !slipped && habit.kind !== "quit" ? "opacity-35" : ""}>{initial.format(parseDay(d.date))}</span>
                {ok && habit.kind !== "quit" && <MarkerX tone={markerFor(habit.category)} />}
                {partial && <MarkerSlash tone={markerFor(habit.category)} />}
                {slipped && <MarkerRing />}
                {d.note && <span className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-current opacity-70" aria-hidden />}
              </button>
            );
          })}
        </div>
      )}
    </div>
      <HabitDaySheet habit={habit} day={sheetDay} today={today} onClose={() => setSheetDay(null)} />
      {confirmSheet}
    </div>
  );
}
