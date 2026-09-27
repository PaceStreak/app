import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useConfirm } from "../../components/Confirm";
import { HabitFields, draftFrom, payloadFrom, type HabitDraft } from "../../components/HabitForm";
import { HabitDaySheet } from "../../components/HabitDaySheet";
import { HabitRow } from "../../components/HabitRow";
import { Archive, CaretLeft, CaretRight, PencilSimple, Trash } from "../../components/phosphor";
import { Sheet } from "../../components/Sheet";
import { toast } from "../../components/toast";
import { ErrorState, Loading, PageHeader, Section, Stat } from "../../components/ui";
import { api, errorText } from "../../lib/api";
import { WEEKDAYS, addDays, weekday, fmtFullDay, fmtMonthDay, fmtMonthYear, fmtProjected, localToday, weekStart } from "../../lib/dates";
import { isDone, markerFor, setHabitDay, skillProjection } from "../../lib/habits";
import { MarkerRing, MarkerSlash, MarkerX } from "../../components/Marker";
import { queryClient, useHabitCatalog } from "../../lib/queries";
import { useMe } from "../../lib/session";
import type { Habit } from "../../lib/types";

const BACKFILL_DAYS = 60;

/**
 * One habit: its streak and strength, a calendar where any recent day can be
 * filled in or corrected (the thing people most often ask of these apps),
 * progress towards a long goal for a skill, and its settings.
 */
export default function HabitDetail() {
  const { id = "" } = useParams();
  const me = useMe();
  const navigate = useNavigate();
  const today = localToday(me.profile.timezone);
  const q = useQuery({ queryKey: ["habit", id], queryFn: () => api<Habit>(`/habits/${id}?days=365`) });
  const catalog = useHabitCatalog();
  const [editing, setEditing] = useState<HabitDraft | null>(null);
  const [sheetDay, setSheetDay] = useState<string | null>(null);
  // The month on show, as its first day.
  const [month, setMonth] = useState(() => `${today.slice(0, 8)}01`);
  const [confirmSheet, ask] = useConfirm();

  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const h = q.data;
  if (!h) return <Loading />;

  const amounts = new Map((h.days ?? []).map((d) => [d.date, d.amount]));
  const notes = (h.days ?? []).filter((d) => d.note).reverse();
  const noted = new Set(notes.map((d) => d.date));
  const skill = skillProjection(h.total, h.total_goal, h.days ?? [], today);
  const refresh = () => Promise.all(["habit", "habits", "stats"].map((k) => queryClient.invalidateQueries({ queryKey: [k] })));

  const save = async () => {
    if (!editing) return;
    try {
      const body = payloadFrom(editing) as Record<string, unknown>;
      delete body.kind;
      await api(`/habits/${h.id}`, { method: "PATCH", body });
      setEditing(null);
      await refresh();
    } catch (err) {
      toast.error(errorText(err));
    }
  };
  const archive = async () => {
    await api(`/habits/${h.id}/${h.archived ? "unarchive" : "archive"}`, { method: "POST" });
    await refresh();
    toast.success(h.archived ? "Back in your list" : "Archived. Its history is kept.");
  };
  const remove = async () => {
    if (!(await ask({ title: `Delete ${h.name}?`, body: "Its whole history goes too. Archive it instead to stop tracking but keep the record.", confirm: "Delete", danger: true }))) return;
    await api(`/habits/${h.id}`, { method: "DELETE" });
    await refresh();
    navigate("/habits", { replace: true });
  };

  const tapDay = (date: string) => {
    if (date > today || date < addDays(today, -BACKFILL_DAYS)) return;
    const current = amounts.get(date) ?? 0;
    if (h.kind === "check") {
      void setHabitDay(h, date, current > 0 ? 0 : 1, today);
      if (!current) toast.success(`${fmtMonthDay(date)}: done`, { action: { label: "Add a note", onClick: () => setSheetDay(date) }, duration: 5000 });
      return;
    }
    setSheetDay(date);
  };

  // The month as whole weeks, starting on the person's first day of the week.
  const startsOn = me.profile.week_starts_on;
  const monthEnd = addDays(`${addDays(month, 32).slice(0, 8)}01`, -1);
  const gridStart = weekStart(month, startsOn);
  const cells = Array.from({ length: Math.ceil((dayIndex(gridStart, monthEnd) + 1) / 7) * 7 }, (_, i) => addDays(gridStart, i));
  const heads = Array.from({ length: 7 }, (_, i) => WEEKDAYS[(startsOn + i) % 7]);
  const earliest = `${addDays(today, -365).slice(0, 8)}01`;
  const prevMonth = `${addDays(month, -1).slice(0, 8)}01`;
  const nextMonth = `${addDays(monthEnd, 1).slice(0, 8)}01`;
  const monthDone = cells.filter((d) => d.slice(0, 7) === month.slice(0, 7) && d <= today && d >= h.started_on && (h.kind === "quit" ? (amounts.get(d) ?? 0) <= 0 : isDone(h, amounts.get(d) ?? 0))).length;
  const weeks = (h.weeks ?? []).slice(-12);
  const s = h.streak;
  const nudge =
    h.kind === "quit"
      ? null
      : s.this_week_days >= s.this_week_target
        ? `This week is kept (${s.this_week_days}/${s.this_week_target}). Anything more is a bonus.`
        : s.days_left != null && s.needed > s.days_left + (h.today.done ? 0 : 1)
          ? `This week can't reach ${s.this_week_target} any more. A freeze covers it if you have one; otherwise a new streak starts next week.`
          : `${s.needed} more ${s.needed === 1 ? "day" : "days"} this week keeps the streak${s.days_left != null ? `, with ${s.days_left} ${s.days_left === 1 ? "day" : "days"} left after today` : ""}.`;

  return (
    <div>
      <PageHeader
        title={`${h.emoji} ${h.name}`}
        back="/habits"
        subtitle={h.cue ? `${h.cue}.` : undefined}
        action={
          <button type="button" className="btn btn-ghost btn-icon" aria-label="Edit habit" onClick={() => setEditing(draftFrom(h))}>
            <PencilSimple size={20} />
          </button>
        }
      />
      {!h.archived && (
        <div className="card mt-4">
          <HabitRow habit={h} today={today} strip={false} />
        </div>
      )}
      {h.why && <p className="mt-3 rounded-md bg-surface-2 px-4 py-3 text-sm text-muted">Why: {h.why}</p>}

      <div className="mt-5 grid grid-cols-3 divide-x divide-line border-y border-line [&>*]:px-3 [&>*]:py-3 [&>*:first-child]:pl-0">
        {h.kind === "quit" ? (
          <>
            <Stat label="Clean days" value={h.clean_run ?? 0} sub={`best ${h.best_clean_run ?? 0}`} />
            <Stat label="Week streak" value={`${h.streak.current} wk`} />
            <Stat label="Strength" value={`${h.strength}%`} />
          </>
        ) : (
          <>
            <Stat label="Streak" value={`${h.streak.current} wk`} sub={`best ${h.streak.longest} wk`} />
            <Stat label="This week" value={`${h.streak.this_week_days}/${h.streak.this_week_target}`} />
            <Stat label="Strength" value={`${h.strength}%`} />
          </>
        )}
      </div>
      {nudge && <p className="mt-3 border-l-0 text-[0.95rem] font-semibold text-accent-text">{nudge}</p>}
      {weeks.length > 1 && (
        <div className="mt-3">
          <div className="flex gap-1" aria-label="The last weeks: kept, missed or in progress">
            {weeks.map((w) => (
              <span
                key={w.week_start}
                title={`Week of ${fmtMonthDay(w.week_start)}: ${w.days}/${w.target} · ${w.status}`}
                className={`h-2 flex-1 rounded-none ${w.status === "kept" || w.status === "repaired" ? "bg-accent" : w.status === "open" ? "bg-accent/35" : w.status === "missed" ? "bg-flame/60" : "bg-surface-2"}`}
              />
            ))}
          </div>
          <p className="mt-1.5 text-xs text-dim">
            Each bar is a week. A week is kept when you reach {h.weekly_target === 7 ? "every day" : `${h.weekly_target} days`}; the first week only asks for the days left after you started.
          </p>
        </div>
      )}

      {skill && (
        <Section title="Long goal">
          <div className="card p-4">
            <p className="num font-semibold">
              {h.kind === "duration" ? `${Math.round(h.total / 6) / 10} of ${Math.round(h.total_goal! / 60)} hours` : `${h.total} of ${h.total_goal} ${h.unit ?? ""}`}
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-none bg-surface-2" role="progressbar" aria-valuenow={skill.pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progress to the long goal">
              <div className="h-full rounded-none bg-accent" style={{ width: `${skill.pct}%` }} />
            </div>
            <p className="mt-2 text-sm text-dim">
              {skill.pct >= 100
                ? "Done. Set a new goal, or keep going for its own sake."
                : skill.eta
                  ? `About ${h.kind === "duration" ? `${Math.round(skill.perWeek / 6) / 10} hours` : `${skill.perWeek} ${h.unit ?? ""}`} a week lately. At that pace, ${fmtProjected(skill.eta, today)}.`
                  : "A few weeks of practice and this shows when you'll get there."}
            </p>
          </div>
        </Section>
      )}

      <Section title="Calendar">
        <div className="card p-4">
          <div className="mx-auto max-w-sm">
            <div className="mb-3 flex items-center justify-between">
              <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label="Previous month" disabled={prevMonth < earliest} onClick={() => setMonth(prevMonth)}>
                <CaretLeft size={18} />
              </button>
              <p className="text-center">
                <span className="block font-semibold">{fmtMonthYear(month)}</span>
                <span className="num block text-xs text-dim">{monthDone} {h.kind === "quit" ? "clean" : "done"}</span>
              </p>
              <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label="Next month" disabled={nextMonth > today} onClick={() => setMonth(nextMonth)}>
                <CaretRight size={18} />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[0.7rem] font-medium text-dim" aria-hidden>
              {heads.map((d) => (
                <span key={d} className={d === "Sun" ? "text-accent-text" : ""}>{d.slice(0, 2)}</span>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-px overflow-hidden rounded-sm border border-line bg-line [&>*]:bg-surface" role="grid" aria-label={`${fmtMonthYear(month)}, tap a day to fill in or correct`}>
              {cells.map((date) => {
                if (date.slice(0, 7) !== month.slice(0, 7)) return <span key={date} />;
                const amount = amounts.get(date) ?? 0;
                const future = date > today;
                const before = date < h.started_on;
                const done = !future && !before && (h.kind === "quit" ? amount <= 0 : isDone(h, amount));
                const slipped = h.kind === "quit" && amount > 0;
                const partial = !done && !slipped && amount > 0;
                const editable = !future && date >= addDays(today, -BACKFILL_DAYS);
                return (
                  <button
                    key={date}
                    type="button"
                    disabled={!editable}
                    onClick={() => tapDay(date)}
                    aria-label={`${fmtFullDay(date)}: ${slipped ? "slipped" : done ? "done" : partial ? `${amount}, partly done` : "not done"}${noted.has(date) ? ", has a note" : ""}`}
                    className={`press num relative grid aspect-square place-items-center text-sm transition-colors hover:bg-surface-2 ${
                      future || before ? "text-dim/45" : done || slipped || partial ? "text-dim/50" : weekday(date) === 6 ? "text-accent-text" : "text-ink"
                    } ${date === today ? "ring-2 ring-accent" : ""} disabled:cursor-default`}
                  >
                    {Number(date.slice(8))}
                    {done && h.kind !== "quit" && <MarkerX tone={markerFor(h.category)} />}
                    {partial && <MarkerSlash tone={markerFor(h.category)} />}
                    {slipped && <MarkerRing />}
                    {noted.has(date) && <span className="absolute bottom-1 size-1 rounded-full bg-current" aria-hidden />}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="mt-4 text-center text-xs text-dim">
            Tap a day to {h.kind === "check" ? "tick or untick it" : h.kind === "quit" ? "log a slip or a note" : "set how much and add a note"}. A dot means a note. Up to {BACKFILL_DAYS} days back.
          </p>
        </div>
      </Section>
      <Section title="Notes" action={
        <button type="button" className="text-sm font-semibold text-accent-text" onClick={() => setSheetDay(today)}>
          Note for today
        </button>
      }>
        {notes.length === 0 ? (
          <p className="card p-4 text-sm text-dim">No notes yet. Open any day, or tap "Add a note" after ticking one, to write how it went.</p>
        ) : (
          <ul className="card divide-y divide-line">
            {notes.slice(0, 30).map((d) => (
              <li key={d.date}>
                <button type="button" className="press w-full px-4 py-3 text-left" disabled={d.date < addDays(today, -BACKFILL_DAYS)} onClick={() => setSheetDay(d.date)}>
                  <span className="block text-xs text-dim">{fmtFullDay(d.date)}</span>
                  <span className="mt-0.5 block text-sm whitespace-pre-line">{d.note}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <p className="mt-3 text-xs text-dim">
        Strength ({h.strength}%) is a slow average of how much of each week's target you met: a missed week dents it; it doesn't erase months.
      </p>

      <div className="mt-8 flex gap-2">
        <button type="button" className="btn btn-secondary flex-1" onClick={() => void archive()}>
          <Archive size={18} /> {h.archived ? "Unarchive" : "Archive"}
        </button>
        <button type="button" className="btn btn-ghost text-danger" onClick={() => void remove()}>
          <Trash size={18} /> Delete
        </button>
      </div>
      <p className="mt-3 text-center text-xs text-dim">Started {fmtMonthDay(h.started_on)}. Private: only you ever see it.</p>

      <HabitDaySheet habit={h} day={sheetDay} today={today} onClose={() => setSheetDay(null)} />

      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Edit habit"
        size="lg"
        footer={
          <button type="button" className="btn btn-primary w-full" disabled={!editing?.name.trim()} onClick={() => void save()}>
            Save
          </button>
        }
      >
        {editing && <HabitFields draft={editing} onChange={setEditing} categories={catalog.data?.categories ?? {}} editing />}
      </Sheet>
      {confirmSheet}
    </div>
  );
}

const dayIndex = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
