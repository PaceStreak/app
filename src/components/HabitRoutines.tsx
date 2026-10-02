import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { Check, PencilSimple, Play, Plus } from "./phosphor";
import { Sheet } from "./Sheet";
import { toast } from "./toast";
import { Field, Section, Segmented } from "./ui";
import { api, errorText, post, put } from "../lib/api";
import { TIMES, isDone, partOfDay, setHabitDay } from "../lib/habits";
import { queryClient } from "../lib/queries";
import { deleteWithUndo } from "../lib/undo";
import type { Habit, HabitRoutine, TimeOfDay } from "../lib/types";

/**
 * Routines: habits done together in order - a morning run of water,
 * stretch, journal. The routine is only an order; each step logs the habit
 * itself, so streaks and XP work exactly as they do one by one.
 */
export function HabitRoutines({ habits, today }: { habits: Habit[]; today: string }) {
  const q = useQuery({ queryKey: ["habit-routines"], queryFn: () => api<HabitRoutine[]>("/habit-routines") });
  const [editing, setEditing] = useState<HabitRoutine | "new" | null>(null);
  const [running, setRunning] = useState<HabitRoutine | null>(null);
  const byId = new Map(habits.map((h) => [h.id, h]));
  const routines = q.data ?? [];
  const [params, setParams] = useSearchParams();

  // ?routine=next (the home-screen shortcut): start the routine for this part
  // of the day, else the first one with steps left.
  useEffect(() => {
    if (params.get("routine") !== "next" || !q.data || !habits.length) return;
    setParams({}, { replace: true });
    const open = q.data.filter((r) => r.habit_ids.some((id) => habits.find((h) => h.id === id && !h.today.done)));
    const now = partOfDay(new Date().getHours());
    const pick = open.find((r) => r.time_of_day === now) ?? open[0];
    if (pick) setRunning(pick);
    else toast(q.data.length ? "Every routine is done for today" : "Make a routine first: tap New under Routines");
  }, [params, setParams, q.data, habits]);
  const doable = habits.filter((h) => h.kind !== "quit");
  if (doable.length < 2 && !routines.length) return null;

  return (
    <Section
      title="Routines"
      action={
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing("new")}>
          <Plus size={16} /> New
        </button>
      }
    >
      {routines.length === 0 ? (
        <p className="text-sm text-dim">String habits into a run you do in order, like a morning routine. Each step still counts on its own habit.</p>
      ) : (
        <ul className="card divide-y divide-line">
          {routines.map((r) => {
            const steps = r.habit_ids.map((id) => byId.get(id)).filter((h): h is Habit => !!h);
            const done = steps.filter((h) => h.today.done).length;
            return (
              <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                <span aria-hidden className="text-xl">{r.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.name}</p>
                  <p className="text-sm text-dim">
                    {done} of {steps.length} done today
                  </p>
                </div>
                <button type="button" className="btn btn-ghost btn-icon" aria-label={`Edit ${r.name}`} onClick={() => setEditing(r)}>
                  <PencilSimple size={18} />
                </button>
                <button type="button" className="btn btn-primary btn-sm" disabled={!steps.length || done === steps.length} onClick={() => setRunning(r)}>
                  <Play size={14} weight="fill" /> {done ? "Resume" : "Start"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {editing && <RoutineEditor routine={editing === "new" ? null : editing} habits={doable} onClose={() => setEditing(null)} />}
      {running && <RoutineRunner routine={running} steps={running.habit_ids.map((id) => byId.get(id)).filter((h): h is Habit => !!h)} today={today} onClose={() => setRunning(null)} />}
    </Section>
  );
}

function RoutineEditor({ routine, habits, onClose }: { routine: HabitRoutine | null; habits: Habit[]; onClose: () => void }) {
  const [name, setName] = useState(routine?.name ?? "Morning");
  const [emoji, setEmoji] = useState(routine?.emoji ?? "🌅");
  const [time, setTime] = useState<TimeOfDay>(routine?.time_of_day ?? "morning");
  const [ids, setIds] = useState<string[]>(routine?.habit_ids ?? []);
  const [busy, setBusy] = useState(false);
  const toggle = (id: string) => setIds(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["habit-routines"] });

  const save = async () => {
    setBusy(true);
    try {
      const body = { name: name.trim(), emoji: emoji.trim() || "🌅", time_of_day: time, habit_ids: ids };
      if (routine) await put(`/habit-routines/${routine.id}`, body);
      else await post("/habit-routines", body);
      await refresh();
      onClose();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!routine) return;
    if (await deleteWithUndo({ path: `/habit-routines/${routine.id}`, label: routine.name, refresh: ["habit-routines"] })) onClose();
  };

  return (
    <Sheet open onClose={onClose} title={routine ? "Edit routine" : "New routine"}>
      <div className="space-y-4">
        <div className="grid grid-cols-[5rem_1fr] gap-3">
          <Field label="Emoji" value={emoji} maxLength={8} onChange={(e) => setEmoji(e.target.value)} />
          <Field label="Name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        </div>
        <Segmented label="When" value={time} onChange={setTime} options={TIMES} />
        <div>
          <p className="field-label">Steps, in the order you tap them</p>
          <ul className="card divide-y divide-line">
            {habits.map((h) => {
              const at = ids.indexOf(h.id);
              return (
                <li key={h.id}>
                  <button type="button" className="press flex w-full items-center gap-3 px-4 py-3 text-left" aria-pressed={at >= 0} onClick={() => toggle(h.id)}>
                    <span className={`num grid size-7 shrink-0 place-items-center rounded-full border text-sm ${at >= 0 ? "border-accent bg-accent text-accent-ink" : "border-line text-dim"}`}>{at >= 0 ? at + 1 : ""}</span>
                    <span aria-hidden>{h.emoji}</span>
                    <span className="min-w-0 flex-1 truncate">{h.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <button type="button" className="btn btn-primary w-full" disabled={busy || !name.trim() || !ids.length} onClick={() => void save()}>
          Save routine
        </button>
        {routine && (
          <button type="button" className="btn btn-ghost w-full text-danger" onClick={() => void remove()}>
            Delete routine
          </button>
        )}
      </div>
    </Sheet>
  );
}

function RoutineRunner({ routine, steps, today, onClose }: { routine: HabitRoutine; steps: Habit[]; today: string; onClose: () => void }) {
  // Start at the first step not yet done today.
  const [index, setIndex] = useState(() => Math.max(0, steps.findIndex((h) => !h.today.done)));
  const [busy, setBusy] = useState(false);
  const step = steps[index];
  const finished = index >= steps.length;

  const next = () => setIndex((i) => i + 1);
  const done = async () => {
    if (!step) return;
    setBusy(true);
    try {
      // A check is a tick; a count or duration is its daily goal, unless more is already logged.
      const goal = step.kind === "check" ? 1 : (step.daily_goal ?? 1);
      if (!isDone(step, step.today.amount)) await setHabitDay(step, today, Math.max(goal, step.today.amount), today);
      next();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open onClose={onClose} title={`${routine.emoji} ${routine.name}`}>
      <div className="flex gap-1" aria-label={`Step ${Math.min(index + 1, steps.length)} of ${steps.length}`}>
        {steps.map((s, i) => (
          <span key={s.id} className={`h-1.5 flex-1 rounded-full ${i < index ? "bg-accent" : i === index ? "bg-accent/40" : "bg-surface-2"}`} />
        ))}
      </div>
      {finished ? (
        <div className="py-8 text-center">
          <Check size={40} className="mx-auto text-accent" aria-hidden />
          <p className="mt-3 text-lg font-semibold">Routine done</p>
          <button type="button" className="btn btn-primary mt-6 w-full" onClick={onClose}>
            Close
          </button>
        </div>
      ) : (
        <div className="py-6 text-center">
          <p className="text-sm text-dim">
            Step {index + 1} of {steps.length}
          </p>
          <p className="mt-2 text-4xl" aria-hidden>
            {step.emoji}
          </p>
          <p className="mt-2 text-xl font-semibold">{step.name}</p>
          {step.kind !== "check" && step.daily_goal && (
            <p className="text-muted">
              {step.daily_goal} {step.unit ?? ""}
            </p>
          )}
          {step.cue && <p className="mt-2 text-sm text-dim">{step.cue}.</p>}
          <div className="mt-6 flex gap-2">
            <button type="button" className="btn btn-ghost flex-1" onClick={next}>
              Skip
            </button>
            <button type="button" className="btn btn-primary flex-[2]" disabled={busy} onClick={() => void done()}>
              {step.today.done ? "Already done, next" : "Done"}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
