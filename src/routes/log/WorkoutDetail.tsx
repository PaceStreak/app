import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { useConfirm } from "../../components/Confirm";
import { DisciplineIcon } from "../../components/icons";
import { ArrowsClockwise, CloudArrowUp, Fire, Lock, PencilSimple, Sneaker, Trash, Trophy, WarningCircle } from "../../components/phosphor";
import { toast } from "../../components/toast";
import { Banner, PageHeader } from "../../components/ui";
import { workoutTitle } from "../../components/WorkoutRow";
import { api } from "../../lib/api";
import { fmtFullDay, localToday, timeOfDay, uuid } from "../../lib/dates";
import { getWorkout, onWorkoutsChanged } from "../../lib/db";
import { useGear, useLibrary, useStats, useWorkouts } from "../../lib/queries";
import { useMe } from "../../lib/session";
import { deleteWorkout, discardFailed, saveWorkout } from "../../lib/sync";
import { EFFORT, FEEL, exerciseOrder, localWeek, volumeKg } from "../../lib/training";
import type { RecordRow, Workout } from "../../lib/types";
import { clock, distance, duration, pace, speed, weight as fmtWeight, compact } from "../../lib/units";
import { FeelIcon } from "./FeelIcon";

export default function WorkoutDetail() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const me = useMe();
  const lib = useLibrary();
  const stats = useStats();
  const all = useWorkouts();
  const gearList = useGear();
  const navigate = useNavigate();
  const [w, setW] = useState<Workout | null | undefined>(undefined);
  const [confirmSheet, ask] = useConfirm();
  const done = params.get("done") === "1";
  const unit = me.profile.weight_unit;
  const dunit = me.profile.distance_unit;

  useEffect(() => {
    const load = () => void getWorkout(id).then((x) => setW(x && !x.deleted_at ? x : null));
    load();
    return onWorkoutsChanged(load);
  }, [id]);

  const records = useQuery({
    queryKey: ["records"],
    queryFn: () => api<{ current: RecordRow[]; recent: RecordRow[] }>("/me/records"),
  });
  const prs = useMemo(
    () => [...(records.data?.recent ?? []), ...(records.data?.current ?? [])].filter((r, i, arr) => r.workout_id === id && r.previous != null && arr.findIndex((x) => x.key === r.key && x.date === r.date) === i),
    [records.data, id],
  );

  const gear = w?.gear_id ? gearList.data?.find((g) => g.id === w.gear_id) : undefined;

  if (w === undefined) return <div className="skeleton mt-6 h-64" />;
  if (w === null)
    return (
      <div className="pt-16 text-center">
        <p className="font-semibold">That session isn't here</p>
        <p className="mt-1 text-muted">It may have been deleted on another device.</p>
        <Link to="/history" className="btn btn-secondary mt-6">
          All sessions
        </Link>
      </div>
    );

  const order = exerciseOrder(w);
  const volume = volumeKg(w);
  const today = stats.data?.today ?? localToday(me.profile.timezone);
  const week = localWeek(all ?? [], stats.data?.chains[0] ?? null, today, me.profile.week_starts_on);
  const target = stats.data?.chains[0]?.this_week_target ?? 3;

  const remove = async () => {
    if (!(await ask({ title: "Delete this session?", body: "It comes off your streak and grid on every device.", confirm: "Delete", danger: true }))) return;
    await deleteWorkout(w.id);
    toast("Session deleted");
    navigate("/history", { replace: true });
  };

  const again = async () => {
    const copy: Workout = {
      ...w,
      id: uuid(),
      started_at: new Date().toISOString(),
      local_date: today,
      sets: w.sets.map((s) => ({ ...s, completed: true })),
      seq: undefined,
      source: "app",
    };
    await saveWorkout(copy);
    toast.success("Logged again", { body: "Same session, today.", action: { label: "Undo", onClick: () => void deleteWorkout(copy.id) } });
    navigate(`/workouts/${copy.id}`, { replace: true });
  };

  const metric = (label: string, value: string | null | undefined) =>
    value ? (
      <div>
        <dt className="text-sm text-dim">{label}</dt>
        <dd className="num mt-0.5 text-xl font-semibold tracking-tight">{value}</dd>
      </div>
    ) : null;

  return (
    <div>
      <PageHeader
        back="/history"
        title={workoutTitle(w, lib)}
        subtitle={`${fmtFullDay(w.local_date)} · ${timeOfDay(w.started_at)}`}
        action={
          <Link to={`/workouts/${w.id}/edit`} className="btn btn-secondary btn-sm">
            <PencilSimple size={16} /> Edit
          </Link>
        }
      />

      {done && (
        <div className="card-raised coach-lead-done mb-5 p-5" data-tone="accent">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-accent text-accent-ink">
              <Fire size={22} weight="fill" />
            </span>
            <div>
              <p className="text-lg font-semibold tracking-tight">{week.count >= target ? "Week kept" : "Session saved"}</p>
              <p className="text-sm text-muted">
                {week.count} of {target} days this week{week.count >= target ? ". The rest is a bonus." : "."}
              </p>
            </div>
          </div>
        </div>
      )}

      {w._error ? (
        <Banner
          tone="danger"
          icon={<WarningCircle size={20} />}
          action={
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => void discardFailed(w.id)}>
              Discard
            </button>
          }
        >
          Not saved: {w._error}. Edit it to fix the problem.
        </Banner>
      ) : w._pending ? (
        <Banner icon={<CloudArrowUp size={20} />}>Saved on this device. It syncs as soon as there's signal.</Banner>
      ) : null}

      <div className="card mt-4 p-5">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-surface-2">
            <DisciplineIcon id={w.discipline} size={22} />
          </span>
          <span className="font-medium text-muted">{lib?.discipline(w.discipline)?.name}</span>
          {w.feel && (
            <span className="chip ml-auto">
              <FeelIcon value={w.feel} size={16} /> {FEEL[w.feel - 1]?.label}
            </span>
          )}
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3">
          {metric("Duration", duration(w.duration_sec))}
          {metric("Distance", distance(w.distance_m, dunit))}
          {w.discipline === "ride" ? metric("Avg speed", speed(w.duration_sec, w.distance_m, dunit)) : metric("Avg pace", pace(w.duration_sec, w.distance_m, dunit))}
          {metric("Elevation", w.elevation_m ? `${Math.round(w.elevation_m)} m` : null)}
          {metric("Effort", w.effort ? (EFFORT.find((e) => e.value >= (w.effort ?? 0))?.label ?? `${w.effort}/10`) : null)}
          {metric("Working sets", w.sets.filter((s) => s.completed && s.kind !== "warmup").length ? String(w.sets.filter((s) => s.completed && s.kind !== "warmup").length) : null)}
          {metric("Volume", volume ? `${compact(unit === "kg" ? volume : volume / 0.45359237)} ${unit}` : null)}
        </dl>
      </div>

      {prs.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-2 flex items-center gap-2 font-semibold">
            <Trophy size={18} weight="fill" className="text-accent-text" /> Personal records
          </h2>
          <div className="card divide-y divide-line">
            {prs.map((r) => (
              <div key={r.key} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0 truncate">{r.label}</span>
                <span className="num shrink-0 text-sm text-accent-text">+{r.gain_pct?.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {order.length > 0 && (
        <section className="mt-5 space-y-3">
          {order.map((exId) => {
            const ex = lib?.byId.get(exId);
            const sets = w.sets.filter((s) => s.exercise_id === exId).sort((a, b) => a.set_index - b.set_index);
            let n = 0;
            return (
              <div key={exId} className="card p-4">
                <Link to={`/exercises/${exId}`} className="font-semibold hover:underline">
                  {ex?.name ?? "Exercise"}
                </Link>
                <ol className="mt-2 space-y-1">
                  {sets.map((s) => {
                    if (s.kind === "work") n++;
                    return (
                      <li key={`${s.set_index}`} className={`num flex items-center gap-3 text-[0.95rem] ${s.completed ? "" : "text-dim line-through"}`}>
                        <span className="w-6 text-sm text-dim">{s.kind === "work" ? n : s.kind[0].toUpperCase()}</span>
                        <span className="flex-1">
                          {ex?.load_type === "time"
                            ? `${s.duration_sec ?? 0} s`
                            : ex?.load_type === "bodyweight"
                              ? `${s.reps ?? 0} reps`
                              : `${fmtWeight(s.weight_kg, unit) || "0"} × ${s.reps ?? 0}`}
                        </span>
                        {s.rpe && <span className="text-sm text-dim">RPE {s.rpe}</span>}
                      </li>
                    );
                  })}
                </ol>
              </div>
            );
          })}
        </section>
      )}

      {(w.splits?.length ?? 0) > 0 && <Splits splits={w.splits!} />}

      {((w.tags?.length ?? 0) > 0 || gear) && (
        <section className="mt-5 flex flex-wrap items-center gap-1.5" aria-label="Tags and gear">
          {w.tags?.map((t) => (
            <Link key={t} to={`/history?q=${encodeURIComponent(`#${t}`)}`} className="press chip">
              #{t}
            </Link>
          ))}
          {gear && (
            <Link to="/settings/gear" className="press chip">
              <Sneaker size={14} aria-hidden /> {gear.name}
            </Link>
          )}
          <span className="sr-only">Tags and gear are private.</span>
        </section>
      )}

      {w.notes && (
        <section className="card mt-5 p-4">
          <p className="mb-1 flex items-center gap-1.5 text-sm text-dim">
            <Lock size={14} /> Private notes
          </p>
          <p className="whitespace-pre-wrap">{w.notes}</p>
        </section>
      )}

      <div className="mt-8 flex gap-3">
        <button type="button" className="btn btn-secondary flex-1" onClick={again}>
          <ArrowsClockwise size={18} /> Log again today
        </button>
        <button type="button" className="btn btn-danger" onClick={remove} aria-label="Delete session">
          <Trash size={18} />
        </button>
      </div>
      {confirmSheet}
    </div>
  );
}

/** Per-kilometre times from an imported track. Private session detail:
 * the fastest kilometre is marked in text, not only by colour. */
function Splits({ splits }: { splits: { m: number; sec: number }[] }) {
  const whole = splits.filter((s) => s.m === 1000);
  const fastest = whole.length > 1 ? Math.min(...whole.map((s) => s.sec)) : null;
  let km = 0;
  return (
    <section className="card mt-5 p-4" aria-labelledby="splits-title">
      <h2 id="splits-title" className="font-semibold">Splits</h2>
      <table className="mt-2 w-full text-sm">
        <thead>
          <tr className="text-left text-dim">
            <th scope="col" className="py-1 font-medium">Km</th>
            <th scope="col" className="py-1 text-right font-medium">Time</th>
            <th scope="col" className="py-1 text-right font-medium">Pace /km</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {splits.map((s, i) => {
            km += s.m / 1000;
            const pace = s.sec / (s.m / 1000);
            const best = s.m === 1000 && s.sec === fastest;
            return (
              <tr key={i} className={best ? "font-semibold" : ""}>
                <th scope="row" className="num py-1.5 text-left font-normal">
                  {s.m === 1000 ? Math.round(km) : km.toFixed(2)}
                  {best && <span className="ml-1.5 text-accent-text">fastest</span>}
                </th>
                <td className="num py-1.5 text-right">{clock(s.sec)}</td>
                <td className="num py-1.5 text-right">{clock(Math.round(pace))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
