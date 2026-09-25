import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useConfirm } from "../../components/Confirm";
import { TagInput } from "../../components/TagsGear";
import { ExercisePicker } from "../../components/ExercisePicker";
import {
  ArrowDown,
  ArrowUp,
  ArrowsClockwise,
  Barbell,
  Check,
  DotsThreeVertical,
  Info,
  Link as Link2,
  LinkBreak,
  Plus,
  Thermometer,
  Timer,
  Trash,
  Trophy,
  X,
} from "../../components/phosphor";
import { PlateCalculator } from "../../components/PlateCalculator";
import { RestBar, useRestTimer } from "../../components/RestTimer";
import { Sheet } from "../../components/Sheet";
import { toast } from "../../components/toast";
import { localDateOf, uuid } from "../../lib/dates";
import { getWorkout, kvGet, kvSet } from "../../lib/db";
import { haptic, prefs } from "../../lib/prefs";
import { useLibrary, useRoutines, useWorkouts, type LibraryIndex } from "../../lib/queries";
import { useMe } from "../../lib/session";
import { saveWorkout } from "../../lib/sync";
import { EFFORT, FEEL, blankWorkout, suggestNext, warmupSets } from "../../lib/training";
import type { Exercise, SetKind, Workout, WorkoutSet } from "../../lib/types";
import { clock, e1rm, parseDuration, parseNumber, toKg, weight as fmtWeight, plural, type WeightUnit } from "../../lib/units";
import { FeelIcon } from "./FeelIcon";

const DRAFT_KEY = "active-workout";

interface DraftSet {
  key: string;
  kind: SetKind;
  weight: string;
  reps: string;
  rpe: number | null;
  time: string;
  done: boolean;
}
interface DraftExercise {
  key: string;
  exercise_id: string;
  rest_sec: number;
  reps_min: number | null;
  reps_max: number | null;
  target_rpe: number | null;
  note: string | null;
  sets: DraftSet[];
  /** Same number = superset with the neighbouring exercises. */
  superset?: number | null;
}
interface Draft {
  id: string;
  started_at: string;
  title: string | null;
  routine_id: string | null;
  editing: boolean;
  notes: string | null;
  /** Optional: drafts saved before tags existed have none. */
  tags?: string[];
  gear_id?: string | null;
  effort: number | null;
  feel: number | null;
  duration_sec: number | null;
  exercises: DraftExercise[];
}

const blankSet = (from?: DraftSet): DraftSet => ({
  key: uuid(),
  kind: "work",
  weight: from?.weight ?? "",
  reps: from?.reps ?? "",
  rpe: null,
  time: from?.time ?? "",
  done: false,
});

function fromWorkout(w: Workout, unit: WeightUnit): Draft {
  const byExercise = new Map<string, DraftExercise>();
  for (const s of [...w.sets].sort((a, b) => a.position - b.position || a.set_index - b.set_index)) {
    const ex =
      byExercise.get(s.exercise_id) ??
      ({ key: uuid(), exercise_id: s.exercise_id, rest_sec: 90, reps_min: null, reps_max: null, target_rpe: null, note: null, sets: [] } as DraftExercise);
    if (s.superset != null) ex.superset = s.superset;
    ex.sets.push({
      key: uuid(),
      kind: s.kind,
      weight: s.weight_kg != null ? fmtWeight(s.weight_kg, unit, false) : "",
      reps: s.reps != null ? String(s.reps) : "",
      rpe: s.rpe,
      time: s.duration_sec != null ? String(s.duration_sec) : "",
      done: s.completed,
    });
    byExercise.set(s.exercise_id, ex);
  }
  return {
    id: w.id,
    started_at: w.started_at,
    title: w.title,
    routine_id: w.routine_id,
    editing: true,
    notes: w.notes,
    tags: w.tags ?? [],
    gear_id: w.gear_id ?? null,
    effort: w.effort,
    feel: w.feel,
    duration_sec: w.duration_sec,
    exercises: [...byExercise.values()],
  };
}

/** Last completed performance of an exercise, from this device's history. */
function lastTime(workouts: Workout[], exerciseId: string, excludeId: string) {
  for (const w of workouts) {
    if (w.id === excludeId) continue;
    const sets = w.sets.filter((s) => s.exercise_id === exerciseId && s.completed);
    if (sets.length) return { date: w.local_date, sets };
  }
  return null;
}

/** "Superset A", "B"... for grouped exercises, in order of appearance. */
function supersetLabel(list: DraftExercise[], index: number): string | undefined {
  const group = list[index].superset;
  if (group == null) return undefined;
  const groups: number[] = [];
  for (const e of list) if (e.superset != null && !groups.includes(e.superset)) groups.push(e.superset);
  return `Superset ${String.fromCharCode(65 + groups.indexOf(group))}`;
}

type MenuItem = { icon: typeof Link2; label: string; run: () => void; danger?: boolean; keep?: boolean };

function supersetActions(list: DraftExercise[], key: string, update: (fn: (d: Draft) => Draft) => void): MenuItem[] {
  const i = list.findIndex((e) => e.key === key);
  const ex = list[i];
  const next = list[i + 1];
  const items: MenuItem[] = [];
  if (next && (ex.superset == null || ex.superset !== next.superset)) {
    items.push({
      icon: Link2,
      label: "Superset with the next exercise",
      run: () =>
        update((d) => {
          const used = d.exercises.map((e) => e.superset ?? -1);
          const group = d.exercises[i].superset ?? d.exercises[i + 1].superset ?? Math.max(0, ...used) + 1;
          const old = d.exercises[i + 1].superset;
          return {
            ...d,
            exercises: d.exercises.map((e, j) => (j === i || j === i + 1 || (old != null && e.superset === old) ? { ...e, superset: group } : e)),
          };
        }),
    });
  }
  if (ex.superset != null) {
    items.push({
      icon: LinkBreak,
      label: "Take out of the superset",
      run: () =>
        update((d) => {
          const exercises = d.exercises.map((e) => (e.key === key ? { ...e, superset: null } : e));
          // A group of one isn't a superset.
          const left = exercises.filter((e) => e.superset === ex.superset);
          return { ...d, exercises: left.length === 1 ? exercises.map((e) => (e.superset === ex.superset ? { ...e, superset: null } : e)) : exercises };
        }),
    });
  }
  return items;
}

function warmupAction(ex: DraftExercise | undefined, lib: NonNullable<ReturnType<typeof useLibrary>>, unit: WeightUnit, workouts: Workout[], workoutId: string, change: (fn: (e: DraftExercise) => DraftExercise) => void): MenuItem[] {
  if (!ex) return [];
  const meta = lib.byId.get(ex.exercise_id);
  if (meta?.load_type !== "weight" || ex.sets.some((s) => s.kind === "warmup")) return [];
  // The working weight: the first filled work set, else last time's top set.
  const typed = ex.sets.find((s) => s.kind === "work" && parseNumber(s.weight))?.weight;
  const last = lastTime(workouts, ex.exercise_id, workoutId)?.sets.filter((s) => s.kind !== "warmup" && s.weight_kg);
  const working = typed ? toKg(parseNumber(typed)!, unit) : last?.length ? Math.max(...last.map((s) => s.weight_kg ?? 0)) : null;
  if (!working) return [];
  const ramp = warmupSets(working, unit);
  if (!ramp.length) return [];
  return [
    {
      icon: Thermometer,
      label: `Add ${ramp.length} warm-up set${ramp.length === 1 ? "" : "s"} up to ${fmtWeight(working, unit)}`,
      run: () =>
        change((e) => ({
          ...e,
          sets: [...ramp.map((r) => ({ key: uuid(), kind: "warmup" as SetKind, weight: fmtWeight(r.weight_kg, unit, false), reps: String(r.reps), rpe: null, time: "", done: false })), ...e.sets],
        })),
    },
  ];
}

function bestKnown(workouts: Workout[], exerciseId: string, excludeId: string) {
  let best = 0;
  for (const w of workouts) {
    if (w.id === excludeId) continue;
    for (const s of w.sets) {
      if (s.exercise_id === exerciseId && s.completed && s.kind !== "warmup" && s.weight_kg && s.reps) best = Math.max(best, e1rm(s.weight_kg, s.reps));
    }
  }
  return best;
}

export default function LiveWorkout({ editId }: { editId?: string }) {
  const me = useMe();
  const unit = me.profile.weight_unit as WeightUnit;
  const lib = useLibrary();
  const routines = useRoutines();
  const workouts = useWorkouts();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [picker, setPicker] = useState<{ mode: "add" } | { mode: "swap"; key: string } | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [plates, setPlates] = useState<number | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [now, setNow] = useState(Date.now());
  const rest = useRestTimer();
  const [confirmSheet, ask] = useConfirm();
  const storeKey = editId ? `edit:${editId}` : DRAFT_KEY;

  // Load: resume a draft, open a workout for editing, or start fresh. Runs
  // until a draft exists, then never again - re-running would clobber edits.
  const loaded = useRef(false);
  useEffect(() => {
    if (loaded.current) return;
    let alive = true;
    (async () => {
      const saved = await kvGet<Draft>(storeKey);
      if (saved) {
        if (alive) {
          loaded.current = true;
          setDraft(saved);
        }
        return;
      }
      if (editId) {
        const w = await getWorkout(editId);
        if (w && alive) {
          loaded.current = true;
          setDraft(fromWorkout(w, unit));
        }
        return;
      }
      const routineId = params.get("routine");
      const fresh: Draft = {
        id: uuid(),
        started_at: new Date().toISOString(),
        title: null,
        routine_id: null,
        editing: false,
        notes: null,
        effort: null,
        feel: null,
        duration_sec: null,
        exercises: [],
      };
      if (routineId) {
        const routine = routines.data?.find((r) => r.id === routineId);
        if (!routine && !routines.data) return; // wait for routines to load
        if (routine) {
          fresh.title = routine.name;
          fresh.routine_id = routine.id;
          fresh.exercises = routine.items.map((it) => ({
            key: uuid(),
            exercise_id: it.exercise_id,
            rest_sec: it.rest_sec ?? lib?.byId.get(it.exercise_id)?.rest_sec ?? 90,
            reps_min: it.reps_min,
            reps_max: it.reps_max,
            target_rpe: it.target_rpe,
            note: it.note,
            sets: Array.from({ length: it.sets }, () => blankSet()),
          }));
        }
      }
      if (alive) {
        loaded.current = true;
        setDraft(fresh);
      }
    })();
    return () => {
      alive = false;
    };
  }, [editId, storeKey, params, routines.data, lib, unit]);

  // Every change is on disk within a beat: a crash or a closed tab loses nothing.
  useEffect(() => {
    if (!draft) return;
    const t = setTimeout(() => void kvSet(storeKey, draft), 250);
    return () => clearTimeout(t);
  }, [draft, storeKey]);

  useEffect(() => {
    if (draft?.editing) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [draft?.editing]);

  // Keep the screen on between sets.
  useEffect(() => {
    if (!prefs.keepAwake() || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request("screen");
      } catch {
        /* denied (battery saver); fine */
      }
    };
    void acquire();
    const onVis = () => document.visibilityState === "visible" && void acquire();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      void lock?.release();
    };
  }, []);

  const update = useCallback((fn: (d: Draft) => Draft) => setDraft((d) => (d ? fn(d) : d)), []);
  const updateExercise = (key: string, fn: (e: DraftExercise) => DraftExercise) =>
    update((d) => ({ ...d, exercises: d.exercises.map((e) => (e.key === key ? fn(e) : e)) }));

  const addExercise = (e: Exercise) => {
    update((d) => ({
      ...d,
      exercises: [
        ...d.exercises,
        { key: uuid(), exercise_id: e.id, rest_sec: e.rest_sec, reps_min: null, reps_max: null, target_rpe: null, note: null, sets: [blankSet()] },
      ],
    }));
    setPicker(null);
  };

  const toWorkout = (d: Draft): Workout => {
    const sets: WorkoutSet[] = [];
    d.exercises.forEach((ex, position) => {
      const meta = lib?.byId.get(ex.exercise_id);
      ex.sets.forEach((s, set_index) => {
        const reps = parseNumber(s.reps);
        const w = parseNumber(s.weight);
        const time = meta?.load_type === "time" ? parseDuration(s.time.includes(":") ? s.time : `0:${s.time || 0}`, "ms") : null;
        if (!s.done && reps == null && w == null && !time) return; // untouched rows are not sets
        sets.push({
          exercise_id: ex.exercise_id,
          position,
          set_index,
          kind: s.kind,
          weight_kg: w != null && meta?.load_type !== "bodyweight" && meta?.load_type !== "time" ? Math.round(toKg(w, unit) * 1000) / 1000 : null,
          reps: reps != null ? Math.round(reps) : null,
          rpe: s.rpe,
          duration_sec: time,
          distance_m: null,
          completed: s.done,
          superset: ex.superset ?? null,
        });
      });
    });
    const start = new Date(d.started_at);
    return {
      ...blankWorkout(d.id, "strength", start),
      local_date: localDateOf(start, me.profile.timezone),
      title: d.title?.trim() || null,
      notes: d.notes?.trim() || null,
      tags: d.tags ?? [],
      gear_id: d.gear_id ?? null,
      routine_id: d.routine_id,
      effort: d.effort,
      feel: d.feel,
      duration_sec: d.editing ? d.duration_sec : Math.round((Date.now() - start.getTime()) / 1000),
      sets,
    };
  };

  const finish = async () => {
    if (!draft) return;
    const workout = toWorkout(draft);
    await saveWorkout(workout);
    await kvSet(storeKey, undefined);
    haptic([12, 30, 18]);
    navigate(`/workouts/${draft.id}${draft.editing ? "" : "?done=1"}`, { replace: true });
  };

  const discard = async () => {
    if (
      !(await ask({
        title: draft?.editing ? "Discard changes?" : "Discard this workout?",
        body: draft?.editing ? "The saved session stays as it was." : "Nothing from it will be saved.",
        confirm: "Discard",
        danger: true,
      }))
    )
      return;
    await kvSet(storeKey, undefined);
    navigate(draft?.editing ? `/workouts/${draft.id}` : "/", { replace: true });
  };

  const completedSets = draft?.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0) ?? 0;
  const elapsed = draft ? (now - new Date(draft.started_at).getTime()) / 1000 : 0;

  if (!draft || !lib) {
    return (
      <div className="space-y-3 pt-6">
        <div className="skeleton h-10 w-48" />
        <div className="skeleton h-48" />
      </div>
    );
  }

  return (
    <div className="pt-3 pb-28">
      <header className="safe-top sticky top-0 z-30 -mx-4 mb-4 flex items-center gap-2 bg-bg/90 px-4 py-2 backdrop-blur-md sm:-mx-6 sm:px-6">
        <button type="button" className="btn btn-ghost btn-icon -ml-3" onClick={discard} aria-label="Discard">
          <X size={22} />
        </button>
        <div className="min-w-0 flex-1">
          <input
            className="w-full truncate bg-transparent text-lg font-semibold tracking-tight outline-none placeholder:text-ink"
            placeholder={draft.editing ? "Workout" : "Workout"}
            value={draft.title ?? ""}
            onChange={(e) => update((d) => ({ ...d, title: e.target.value }))}
            aria-label="Workout name"
            maxLength={80}
          />
          <p className="num text-sm text-dim">
            {draft.editing ? "Editing" : clock(elapsed)} · {completedSets} {completedSets === 1 ? "set" : "sets"}
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setFinishing(true)} disabled={completedSets === 0 && !draft.editing}>
          {draft.editing ? "Save" : "Finish"}
        </button>
      </header>

      {draft.exercises.length === 0 && (
        <div className="card flex flex-col items-center px-6 py-12 text-center">
          <span className="mb-4 grid size-14 place-items-center rounded-2xl bg-surface-2">
            <Barbell size={28} />
          </span>
          <p className="font-semibold">Add your first exercise</p>
          <p className="mt-1 text-[0.95rem] text-muted">Or start from a routine next time.</p>
        </div>
      )}

      <div className="space-y-4">
        {draft.exercises.map((ex, index) => (
          <ExerciseBlock
            key={ex.key}
            ex={ex}
            lib={lib}
            unit={unit}
            workouts={workouts ?? []}
            workoutId={draft.id}
            onChange={(fn) => updateExercise(ex.key, fn)}
            onMenu={() => setMenu(ex.key)}
            onPlates={(w) => setPlates(w)}
            onSetDone={(restSec) => {
              haptic(14);
              // In a superset, go straight to the next exercise; rest comes
              // after the last one in the group.
              const next = draft.exercises[index + 1];
              const midSuperset = ex.superset != null && next?.superset === ex.superset;
              if (prefs.autoRest() && !draft.editing && !midSuperset) rest.start(restSec);
            }}
            first={index === 0}
            supersetLabel={supersetLabel(draft.exercises, index)}
          />
        ))}
      </div>

      <button type="button" className="btn btn-secondary mt-4 h-14 w-full" onClick={() => setPicker({ mode: "add" })}>
        <Plus size={20} /> Add exercise
      </button>
      {!draft.editing && !rest.running && (
        <button type="button" className="btn btn-ghost mt-2 w-full text-muted" onClick={() => rest.start(90)}>
          <Timer size={18} /> Start a rest timer
        </button>
      )}

      <RestBar timer={rest} />

      <ExercisePicker
        open={picker !== null}
        title={picker?.mode === "swap" ? "Swap for" : "Add exercise"}
        onClose={() => setPicker(null)}
        onPick={(e) => {
          if (picker?.mode === "swap") {
            updateExercise(picker.key, (x) => ({ ...x, exercise_id: e.id, rest_sec: e.rest_sec }));
            setPicker(null);
          } else addExercise(e);
        }}
      />

      <Sheet open={menu !== null} onClose={() => setMenu(null)} title={lib.byId.get(draft.exercises.find((e) => e.key === menu)?.exercise_id ?? "")?.name}>
        {menu && (
          <div className="-mx-2 flex flex-col">
            {[
              { icon: ArrowsClockwise, label: "Swap exercise", run: () => setPicker({ mode: "swap", key: menu }) },
              {
                icon: ArrowUp,
                label: "Move up",
                run: () =>
                  update((d) => {
                    const i = d.exercises.findIndex((e) => e.key === menu);
                    if (i <= 0) return d;
                    const list = [...d.exercises];
                    [list[i - 1], list[i]] = [list[i], list[i - 1]];
                    return { ...d, exercises: list };
                  }),
              },
              {
                icon: ArrowDown,
                label: "Move down",
                run: () =>
                  update((d) => {
                    const i = d.exercises.findIndex((e) => e.key === menu);
                    if (i < 0 || i >= d.exercises.length - 1) return d;
                    const list = [...d.exercises];
                    [list[i + 1], list[i]] = [list[i], list[i + 1]];
                    return { ...d, exercises: list };
                  }),
              },
              ...supersetActions(draft.exercises, menu, update),
              ...warmupAction(draft.exercises.find((e) => e.key === menu), lib, unit, workouts ?? [], draft.id, (fn) => updateExercise(menu, fn)),
              {
                icon: Timer,
                label: `Rest: ${clock(draft.exercises.find((e) => e.key === menu)?.rest_sec ?? 90)} (tap to change)`,
                run: () =>
                  updateExercise(menu, (e) => {
                    const steps = [45, 60, 90, 120, 150, 180, 240];
                    const next = steps[(steps.indexOf(e.rest_sec) + 1) % steps.length] ?? 90;
                    return { ...e, rest_sec: next };
                  }),
                keep: true,
              },
              { icon: Trash, label: "Remove exercise", danger: true, run: () => update((d) => ({ ...d, exercises: d.exercises.filter((e) => e.key !== menu) })) },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                className={`press flex items-center gap-3 rounded-xl px-3 py-3.5 text-left font-medium hover:bg-surface-2 ${item.danger ? "text-danger" : ""}`}
                onClick={() => {
                  item.run();
                  if (!item.keep) setMenu(null);
                }}
              >
                <item.icon size={20} /> {item.label}
              </button>
            ))}
          </div>
        )}
      </Sheet>

      <Sheet open={plates !== null} onClose={() => setPlates(null)} title="Plate calculator">
        {plates !== null && <PlateCalculator unit={unit} initial={plates || undefined} />}
      </Sheet>

      <Sheet
        open={finishing}
        onClose={() => setFinishing(false)}
        title={draft.editing ? "Save changes" : "Nice work."}
        footer={
          <button type="button" className="btn btn-primary h-13 w-full" onClick={finish}>
            {draft.editing ? "Save" : "Save workout"}
          </button>
        }
      >
        {!draft.editing && (
          <p className="num -mt-1 mb-5 text-muted">
            {clock(elapsed)} · {plural(completedSets, "set")} · {plural(draft.exercises.length, "exercise")}
          </p>
        )}
        <fieldset>
          <legend className="field-label">Effort</legend>
          <div className="seg" role="group" aria-label="Effort">
            {EFFORT.map((e) => (
              <button key={e.value} type="button" aria-pressed={draft.effort === e.value} onClick={() => update((d) => ({ ...d, effort: d.effort === e.value ? null : e.value }))}>
                {e.label}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="mt-5">
          <legend className="field-label">How it felt</legend>
          <div className="grid grid-cols-5 gap-2">
            {FEEL.map((f) => (
              <button
                key={f.value}
                type="button"
                aria-pressed={draft.feel === f.value}
                onClick={() => update((d) => ({ ...d, feel: d.feel === f.value ? null : f.value }))}
                className={`press flex flex-col items-center gap-1 rounded-2xl border py-2.5 text-xs font-semibold ${draft.feel === f.value ? "border-transparent bg-accent text-accent-ink" : "border-line text-muted"}`}
              >
                <FeelIcon value={f.value} size={24} weight={draft.feel === f.value ? "fill" : "regular"} />
                {f.label}
              </button>
            ))}
          </div>
        </fieldset>
        <textarea
          className="input mt-5"
          placeholder="Notes. Private: only you ever see these."
          value={draft.notes ?? ""}
          maxLength={1000}
          onChange={(e) => update((d) => ({ ...d, notes: e.target.value }))}
          aria-label="Private notes"
        />
        <div className="mt-5">
          <TagInput value={draft.tags ?? []} onChange={(tags) => update((d) => ({ ...d, tags }))} />
        </div>
      </Sheet>
      {confirmSheet}
    </div>
  );
}

function ExerciseBlock({
  ex,
  lib,
  unit,
  workouts,
  workoutId,
  onChange,
  onMenu,
  onPlates,
  onSetDone,
  first,
  supersetLabel,
}: {
  ex: DraftExercise;
  lib: LibraryIndex;
  unit: WeightUnit;
  workouts: Workout[];
  workoutId: string;
  onChange: (fn: (e: DraftExercise) => DraftExercise) => void;
  onMenu: () => void;
  onPlates: (w: number) => void;
  onSetDone: (restSec: number) => void;
  first: boolean;
  supersetLabel?: string;
}) {
  const meta = lib.byId.get(ex.exercise_id);
  const loadType = meta?.load_type ?? "weight";
  const last = useMemo(() => lastTime(workouts, ex.exercise_id, workoutId), [workouts, ex.exercise_id, workoutId]);
  const best = useMemo(() => bestKnown(workouts, ex.exercise_id, workoutId), [workouts, ex.exercise_id, workoutId]);
  const [cue, setCue] = useState(first && !last);
  const [rpeFor, setRpeFor] = useState<string | null>(null);
  const suggestion = last
    ? suggestNext(last.sets.map((s) => ({ weight_kg: s.weight_kg, reps: s.reps, rpe: s.rpe, kind: s.kind, duration_sec: s.duration_sec })), {
        repsMax: ex.reps_max,
        targetRpe: ex.target_rpe,
        unit,
        exercise: meta,
      })
    : null;
  const lastWork = last?.sets.filter((s) => s.kind !== "warmup") ?? [];
  const blockRef = useRef<HTMLElement>(null);

  const setSet = (key: string, patch: Partial<DraftSet>) =>
    onChange((e) => ({ ...e, sets: e.sets.map((s) => (s.key === key ? { ...s, ...patch } : s)) }));

  const toggleDone = (s: DraftSet, i: number) => {
    if (s.done) return setSet(s.key, { done: false });
    // An empty row + tick means "same as last time" - the fastest possible log.
    const ghost = lastWork[i] ?? lastWork[lastWork.length - 1];
    const patch: Partial<DraftSet> = { done: true };
    if (!s.weight && ghost?.weight_kg != null && loadType !== "bodyweight" && loadType !== "time") patch.weight = fmtWeight(ghost.weight_kg, unit, false);
    if (!s.reps && ghost?.reps != null) patch.reps = String(ghost.reps);
    if (!s.time && ghost?.duration_sec != null) patch.time = String(ghost.duration_sec);
    setSet(s.key, patch);
    onSetDone(ex.rest_sec);
    const w = parseNumber(patch.weight ?? s.weight);
    const r = parseNumber(patch.reps ?? s.reps);
    if (w && r && best > 0 && s.kind !== "warmup" && e1rm(toKg(w, unit), r) > best) {
      haptic([20, 40, 20, 40, 60]);
      toast.celebrate(`PR on ${meta?.name ?? "this lift"}`, { icon: <Trophy size={20} weight="fill" className="text-accent-text" />, body: "Estimated 1RM just went up." });
    }
  };

  const cycleKind = (s: DraftSet) => {
    const order: SetKind[] = ["work", "warmup", "drop", "failure"];
    setSet(s.key, { kind: order[(order.indexOf(s.kind) + 1) % order.length] });
  };

  let workNumber = 0;
  return (
    <section ref={blockRef} className={`card overflow-hidden ${supersetLabel ? "superset-block" : ""}`} aria-label={supersetLabel ? `${meta?.name}, ${supersetLabel}` : meta?.name}>
      <div className="flex items-start gap-2 p-4 pb-2">
        <div className="min-w-0 flex-1">
          {supersetLabel && (
            <p className="mb-1 flex items-center gap-1 text-xs font-semibold tracking-wide text-accent-text uppercase">
              <Link2 size={12} aria-hidden /> {supersetLabel}
            </p>
          )}
          <h2 className="text-[1.05rem] font-semibold tracking-tight">{meta?.name ?? "Exercise"}</h2>
          <p className="num mt-0.5 text-sm text-dim">
            {last ? (
              <>
                Last: {lastWork.map((s) => (loadType === "bodyweight" ? `${s.reps}` : loadType === "time" ? `${s.duration_sec}s` : `${fmtWeight(s.weight_kg, unit, false)}×${s.reps}`)).join(", ")}
              </>
            ) : (
              "First time: pick a weight that leaves 2-3 reps in the tank."
            )}
          </p>
          {suggestion && (
            <p className="mt-1 text-sm text-accent-text">
              Try{" "}
              {suggestion.duration_sec
                ? clock(suggestion.duration_sec)
                : !suggestion.weight_kg
                  ? `${suggestion.reps} reps`
                  : `${fmtWeight(suggestion.weight_kg, unit)}${suggestion.reps ? ` × ${suggestion.reps}` : ""}`}{" "}
              · {suggestion.reason.toLowerCase()}
            </p>
          )}
          {(ex.reps_min || ex.reps_max) && (
            <p className="mt-1 text-sm text-muted">
              Target {ex.reps_min && ex.reps_max && ex.reps_min !== ex.reps_max ? `${ex.reps_min}-${ex.reps_max}` : (ex.reps_max ?? ex.reps_min)} reps
              {ex.target_rpe ? ` · RPE ${ex.target_rpe}` : ""}
            </p>
          )}
        </div>
        {meta?.cue && (
          <button type="button" className="btn btn-ghost btn-icon btn-sm text-dim" aria-expanded={cue} aria-label="How to do it" onClick={() => setCue(!cue)}>
            <Info size={18} />
          </button>
        )}
        {meta?.equipment === "barbell" && (
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-sm text-dim"
            aria-label="Plate calculator"
            onClick={() => onPlates(parseNumber(ex.sets.find((s) => s.weight)?.weight ?? "") ?? 0)}
          >
            <Barbell size={18} />
          </button>
        )}
        <button type="button" className="btn btn-ghost btn-icon btn-sm text-dim" aria-label="Exercise options" onClick={onMenu}>
          <DotsThreeVertical size={20} weight="bold" />
        </button>
      </div>
      {cue && meta?.cue && <p className="mx-4 mb-2 rounded-xl bg-surface-2 px-3 py-2 text-sm text-muted">{meta.cue}</p>}

      <div className="px-2 pb-2">
        <div className="set-grid px-2 pb-1 text-[0.7rem] font-semibold tracking-wide text-dim uppercase">
          <span>Set</span>
          <span>{loadType === "bodyweight" ? "" : loadType === "time" ? "" : loadType === "weighted_bw" ? `+${unit}` : unit}</span>
          <span>{loadType === "time" ? "Seconds" : "Reps"}</span>
          <span />
        </div>
        {ex.sets.map((s, i) => {
          if (s.kind === "work") workNumber++;
          const ghost = lastWork[i] ?? lastWork[lastWork.length - 1];
          return (
            <div key={s.key}>
              <div className={`set-grid set-row items-center rounded-xl px-2 py-1 ${s.done ? "is-done" : ""}`}>
                <button type="button" onClick={() => cycleKind(s)} className="set-kind" data-kind={s.kind} aria-label={`Set type: ${s.kind}. Tap to change.`}>
                  {s.kind === "work" ? workNumber : s.kind === "warmup" ? "W" : s.kind === "drop" ? "D" : "F"}
                </button>
                {loadType === "bodyweight" || loadType === "time" ? (
                  <span className="text-center text-sm text-dim">{loadType === "bodyweight" ? "BW" : ""}</span>
                ) : (
                  <input
                    className="set-input num"
                    inputMode="decimal"
                    placeholder={ghost?.weight_kg != null ? fmtWeight(ghost.weight_kg, unit, false) : "0"}
                    value={s.weight}
                    onChange={(e) => setSet(s.key, { weight: e.target.value.replace(/[^\d.,]/g, "") })}
                    aria-label={`Set ${i + 1} weight in ${unit}`}
                  />
                )}
                {loadType === "time" ? (
                  <input
                    className="set-input num"
                    inputMode="numeric"
                    placeholder={ghost?.duration_sec != null ? String(ghost.duration_sec) : "30"}
                    value={s.time}
                    onChange={(e) => setSet(s.key, { time: e.target.value.replace(/[^\d]/g, "") })}
                    aria-label={`Set ${i + 1} seconds`}
                  />
                ) : (
                  <input
                    className="set-input num"
                    inputMode="numeric"
                    placeholder={ghost?.reps != null ? String(ghost.reps) : String(ex.reps_max ?? 8)}
                    value={s.reps}
                    onChange={(e) => setSet(s.key, { reps: e.target.value.replace(/[^\d]/g, "") })}
                    aria-label={`Set ${i + 1} reps`}
                  />
                )}
                <button type="button" onClick={() => toggleDone(s, i)} className="set-check press" aria-pressed={s.done} aria-label={s.done ? `Set ${i + 1} done. Tap to undo.` : `Complete set ${i + 1}`}>
                  <Check size={20} weight="bold" />
                </button>
              </div>
              {s.done && (
                <div className="flex items-center gap-1.5 px-2 pb-1 pl-12">
                  {rpeFor === s.key ? (
                    <>
                      <span className="text-xs text-dim">RPE</span>
                      {[6, 7, 8, 9, 10].map((v) => (
                        <button
                          key={v}
                          type="button"
                          className={`chip num h-7 px-2.5 ${s.rpe === v ? "chip-accent" : ""}`}
                          onClick={() => {
                            setSet(s.key, { rpe: s.rpe === v ? null : v });
                            setRpeFor(null);
                          }}
                        >
                          {v}
                        </button>
                      ))}
                    </>
                  ) : (
                    <button type="button" className="text-xs font-semibold text-dim" onClick={() => setRpeFor(s.key)}>
                      {s.rpe ? `RPE ${s.rpe}` : "+ How hard (RPE)"}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        <div className="mt-1 flex gap-2 px-2">
          <button
            type="button"
            className="btn btn-ghost btn-sm flex-1 text-muted"
            onClick={() => onChange((e) => ({ ...e, sets: [...e.sets, blankSet(e.sets[e.sets.length - 1])] }))}
          >
            <Plus size={16} /> Add set
          </button>
          {ex.sets.length > 1 && (
            <button
              type="button"
              className="btn btn-ghost btn-sm text-dim"
              onClick={() => onChange((e) => ({ ...e, sets: e.sets.slice(0, -1) }))}
              aria-label="Remove last set"
            >
              Remove last
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

