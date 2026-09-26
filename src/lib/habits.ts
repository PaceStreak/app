import { addDays } from "./dates";
import { queryClient } from "./queries";
import { sendOrQueue } from "./requests";
import { toast } from "../components/toast";
import type { Habit, TimeOfDay } from "./types";

export const TIMES: { value: TimeOfDay; label: string }[] = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
  { value: "anytime", label: "Any time" },
];

/** Which part of the day it is now, to put those habits first. */
export function partOfDay(hour: number): TimeOfDay {
  if (hour >= 4 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 || hour < 4) return "evening";
  return "anytime";
}

/** Today's habits in a sensible order: the current part of the day, then
 * any time, then the rest; unfinished before finished within each. */
export function orderForToday(habits: Habit[], now: TimeOfDay): Habit[] {
  const rank = (h: Habit) => (h.time_of_day === now ? 0 : h.time_of_day === "anytime" ? 1 : 2);
  return [...habits].sort((a, b) => rank(a) - rank(b) || Number(a.today.done) - Number(b.today.done) || a.position - b.position);
}

/** Every habit being built is done today; habits being broken don't count. */
export function allDoneToday(habits: Habit[]): boolean {
  const doing = habits.filter((h) => h.kind !== "quit" && !h.archived);
  return doing.length > 1 && doing.every((h) => h.today.done);
}

export function isDone(h: Pick<Habit, "kind" | "daily_goal">, amount: number): boolean {
  if (h.kind === "quit") return amount <= 0;
  if (h.kind === "check") return amount > 0;
  return amount >= (h.daily_goal ?? 1);
}

/** "3 / 6 glasses", "12 / 20 min", or nothing for a check. */
export function progressText(h: Pick<Habit, "kind" | "daily_goal" | "unit">, amount: number): string | null {
  if (h.kind !== "count" && h.kind !== "duration") return null;
  const unit = h.kind === "duration" ? "min" : (h.unit ?? "");
  return `${fmt(amount)} / ${fmt(h.daily_goal ?? 1)} ${unit}`.trim();
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** A sensible step for the + button: a glass, a page... or 5 minutes. */
export function stepFor(h: Pick<Habit, "kind" | "daily_goal">): number {
  if (h.kind === "duration") return (h.daily_goal ?? 10) >= 30 ? 10 : 5;
  if (h.kind === "count") return (h.daily_goal ?? 1) >= 50 ? 10 : 1;
  return 1;
}

/**
 * Set a day's amount, optimistically. Sent as an absolute PUT, so a retry
 * after a dropped connection can never double-count; with no signal it's
 * queued and sent later.
 */
/** `note` left undefined keeps whatever note the day already has. */
export async function setHabitDay(habit: Habit, day: string, amount: number, today: string, note?: string | null): Promise<"sent" | "queued"> {
  const before = queryClient.getQueryData<Habit[]>(["habits"]);
  queryClient.setQueryData<Habit[]>(["habits"], (old) =>
    old?.map((h) =>
      h.id !== habit.id
        ? h
        : {
            ...h,
            today: day === today ? { amount, done: isDone(h, amount) } : h.today,
            recent: h.recent?.map((d) => (d.date === day ? { ...d, amount, note: note === undefined ? d.note : note } : d)),
          },
    ),
  );
  if (day === today && before && allDoneToday(queryClient.getQueryData<Habit[]>(["habits"]) ?? []) && !allDoneToday(before)) {
    toast.celebrate("Every habit done today", { body: "That's the whole list. See you tomorrow." });
  }
  queryClient.setQueryData<Habit>(["habit", habit.id], (old) => {
    if (!old) return old;
    const prev = (old.days ?? []).find((d) => d.date === day);
    const kept = note === undefined ? prev?.note : note;
    const days = (old.days ?? []).filter((d) => d.date !== day);
    if (amount > 0 || kept) days.push({ date: day, amount, note: kept ?? null });
    days.sort((a, b) => (a.date < b.date ? -1 : 1));
    return { ...old, days, today: day === today ? { amount, done: isDone(old, amount) } : old.today };
  });
  const result = await sendOrQueue(`/habits/${habit.id}/days/${day}`, "PUT", note === undefined ? { amount } : { amount, note: note ?? "" });
  if (result === "sent") {
    for (const key of ["habits", "habit", "stats"]) void queryClient.invalidateQueries({ queryKey: [key] });
  }
  return result;
}

/**
 * Where a skill is heading: total so far against its long goal, and the date
 * it's reached at the last four weeks' pace. Null without a goal or a pace.
 */
export function skillProjection(total: number, goal: number | null, days: { date: string; amount: number }[], today: string): { pct: number; eta: string | null; perWeek: number } | null {
  if (!goal) return null;
  const since = addDays(today, -27);
  const recent = days.filter((d) => d.date >= since && d.date <= today).reduce((n, d) => n + d.amount, 0);
  const perDay = recent / 28;
  const left = goal - total;
  const eta = left <= 0 ? today : perDay > 0 ? addDays(today, Math.ceil(left / perDay)) : null;
  return { pct: Math.min(100, Math.round((total / goal) * 100)), eta: eta && eta <= addDays(today, 3650) ? eta : null, perWeek: Math.round(perDay * 7 * 10) / 10 };
}
