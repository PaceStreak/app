import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useConfirm } from "../../components/Confirm";
import { HabitFields, draftFrom, payloadFrom, type HabitDraft } from "../../components/HabitForm";
import { HabitRow } from "../../components/HabitRow";
import { Archive, PencilSimple, Trash } from "../../components/phosphor";
import { Sheet } from "../../components/Sheet";
import { toast } from "../../components/toast";
import { ErrorState, Loading, PageHeader, Section, Stat } from "../../components/ui";
import { api, errorText } from "../../lib/api";
import { addDays, fmtFullDay, fmtProjected, fmtMonthDay, localToday, weekStart } from "../../lib/dates";
import { isDone, setHabitDay, skillProjection } from "../../lib/habits";
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
  const [dayEdit, setDayEdit] = useState<{ date: string; value: string } | null>(null);
  const [confirmSheet, ask] = useConfirm();

  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const h = q.data;
  if (!h) return <Loading />;

  const amounts = new Map((h.days ?? []).map((d) => [d.date, d.amount]));
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

  const setDay = async (date: string, amount: number) => {
    await setHabitDay(h, date, amount, today);
    setDayEdit(null);
  };
  const tapDay = (date: string) => {
    if (date > today || date < addDays(today, -BACKFILL_DAYS)) return;
    const current = amounts.get(date) ?? 0;
    if (h.kind === "check") return void setDay(date, current > 0 ? 0 : 1);
    setDayEdit({ date, value: current ? String(current) : "" });
  };

  // Twelve weeks, a row per week, ending with this one.
  const start = addDays(weekStart(today, me.profile.week_starts_on), -7 * 11);
  const grid = Array.from({ length: 12 }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));

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
          <HabitRow habit={h} today={today} />
        </div>
      )}
      {h.why && <p className="mt-3 rounded-2xl bg-surface-2 px-4 py-3 text-sm text-muted">Why: {h.why}</p>}

      <div className="card mt-4 grid grid-cols-3 gap-4 p-4">
        {h.kind === "quit" ? (
          <>
            <Stat label="Clean days" value={h.clean_run ?? 0} sub={`best ${h.best_clean_run ?? 0}`} />
            <Stat label="Week streak" value={`${h.streak.current} wk`} />
            <Stat label="Strength" value={`${h.strength}%`} />
          </>
        ) : (
          <>
            <Stat label="Streak" value={`${h.streak.current} wk`} sub={`best ${h.streak.longest}`} />
            <Stat label="This week" value={`${h.streak.this_week_days}/${h.streak.this_week_target}`} />
            <Stat label="Strength" value={`${h.strength}%`} />
          </>
        )}
      </div>
      <p className="mt-2 text-xs text-dim">
        Strength is a slow average of how much of each week's target you met: a missed week dents it; it doesn't erase months.
      </p>

      {skill && (
        <Section title="Long goal">
          <div className="card p-4">
            <p className="num font-semibold">
              {h.kind === "duration" ? `${Math.round(h.total / 6) / 10} of ${Math.round(h.total_goal! / 60)} hours` : `${h.total} of ${h.total_goal} ${h.unit ?? ""}`}
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={skill.pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progress to the long goal">
              <div className="h-full rounded-full bg-accent" style={{ width: `${skill.pct}%` }} />
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

      <Section title="Last twelve weeks">
        <div className="card p-4">
          <div className="grid grid-cols-7 gap-1.5" role="grid" aria-label="Days, tap to fill in or correct">
            {grid.flat().map((date) => {
              const amount = amounts.get(date) ?? 0;
              const future = date > today;
              const done = !future && date >= h.started_on && (h.kind === "quit" ? amount <= 0 : isDone(h, amount));
              const slipped = h.kind === "quit" && amount > 0;
              const editable = !future && date >= addDays(today, -BACKFILL_DAYS);
              return (
                <button
                  key={date}
                  type="button"
                  disabled={!editable}
                  onClick={() => tapDay(date)}
                  aria-label={`${fmtFullDay(date)}: ${slipped ? "slipped" : done ? "done" : "not done"}`}
                  className={`aspect-square rounded-md text-[0.6rem] ${future ? "bg-transparent" : slipped ? "bg-flame-soft" : done ? "bg-accent" : "bg-surface-2"} ${date === today ? "ring-2 ring-ink/40" : ""}`}
                />
              );
            })}
          </div>
          <p className="mt-3 text-xs text-dim">
            Tap a day to {h.kind === "check" ? "tick or untick it" : h.kind === "quit" ? "log or clear a slip" : "set how much"}. Up to {BACKFILL_DAYS} days back.
          </p>
        </div>
      </Section>

      <div className="mt-8 flex gap-2">
        <button type="button" className="btn btn-secondary flex-1" onClick={() => void archive()}>
          <Archive size={18} /> {h.archived ? "Unarchive" : "Archive"}
        </button>
        <button type="button" className="btn btn-ghost text-danger" onClick={() => void remove()}>
          <Trash size={18} /> Delete
        </button>
      </div>
      <p className="mt-3 text-center text-xs text-dim">Started {fmtMonthDay(h.started_on)}. Private: only you ever see it.</p>

      <Sheet
        open={dayEdit !== null}
        onClose={() => setDayEdit(null)}
        title={dayEdit ? fmtFullDay(dayEdit.date) : ""}
        footer={
          <button type="button" className="btn btn-primary w-full" onClick={() => dayEdit && void setDay(dayEdit.date, Number(dayEdit.value.replace(",", ".")) || 0)}>
            Save
          </button>
        }
      >
        {dayEdit && (
          <div>
            <label className="field-label" htmlFor="day-amount">
              {h.kind === "quit" ? "Slips that day" : h.kind === "duration" ? "Minutes" : (h.unit ?? "Amount")}
            </label>
            <input id="day-amount" className="input num" inputMode="decimal" autoFocus value={dayEdit.value} onChange={(e) => setDayEdit({ ...dayEdit, value: e.target.value })} />
            <p className="field-hint">{h.kind === "quit" ? "Zero clears it: a clean day." : "Zero clears the day."}</p>
          </div>
        )}
      </Sheet>

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
