import { useState } from "react";
import { useNavigate } from "react-router";
import { PageHeader } from "../../components/ui";
import { toast } from "../../components/toast";
import { localDateOf, toLocalInput } from "../../lib/dates";
import { useLibrary } from "../../lib/queries";
import { useMe } from "../../lib/session";
import { saveWorkout } from "../../lib/sync";
import { EFFORT, FEEL } from "../../lib/training";
import type { Workout } from "../../lib/types";
import { distance, parseDuration, parseNumber, toMetres, type DistanceUnit } from "../../lib/units";
import { FeelIcon } from "./FeelIcon";

export function QuickEdit({ workout }: { workout: Workout }) {
  const me = useMe();
  const lib = useLibrary();
  const navigate = useNavigate();
  const unit = me.profile.distance_unit as DistanceUnit;
  const [discipline, setDiscipline] = useState(workout.discipline);
  const [start, setStart] = useState(toLocalInput(workout.started_at));
  const [dur, setDur] = useState(workout.duration_sec ? `${Math.floor(workout.duration_sec / 3600)}:${String(Math.round((workout.duration_sec % 3600) / 60)).padStart(2, "0")}` : "");
  const [dist, setDist] = useState(workout.distance_m ? distance(workout.distance_m, unit, false) : "");
  const [elev, setElev] = useState(workout.elevation_m ? String(workout.elevation_m) : "");
  const [effort, setEffort] = useState(workout.effort);
  const [feel, setFeel] = useState(workout.feel);
  const [title, setTitle] = useState(workout.title ?? "");
  const [notes, setNotes] = useState(workout.notes ?? "");
  const metrics = new Set(lib?.discipline(discipline)?.metrics ?? ["duration"]);

  const save = async () => {
    const started = new Date(start);
    const d = parseNumber(dist);
    await saveWorkout({
      ...workout,
      discipline,
      started_at: started.toISOString(),
      local_date: localDateOf(started, me.profile.timezone),
      duration_sec: parseDuration(dur),
      distance_m: metrics.has("distance") && d ? toMetres(d, unit) : null,
      elevation_m: metrics.has("elevation") ? parseNumber(elev) : null,
      effort,
      feel,
      title: title.trim() || null,
      notes: notes.trim() || null,
    });
    toast.success("Saved");
    navigate(`/workouts/${workout.id}`, { replace: true });
  };

  return (
    <div>
      <PageHeader title="Edit session" back />
      <div className="space-y-5">
        <div>
          <label className="field-label" htmlFor="qe-d">Activity</label>
          <select id="qe-d" className="input" value={discipline} onChange={(e) => setDiscipline(e.target.value)}>
            {lib?.lib.disciplines.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="qe-s">Started</label>
          <input id="qe-s" type="datetime-local" className="input" value={start} max={toLocalInput(new Date().toISOString())} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label" htmlFor="qe-dur">Duration (h:mm)</label>
            <input id="qe-dur" className="input num" inputMode="numeric" value={dur} onChange={(e) => setDur(e.target.value)} placeholder="0:45" />
          </div>
          {metrics.has("distance") && (
            <div>
              <label className="field-label" htmlFor="qe-dist">Distance ({unit})</label>
              <input id="qe-dist" className="input num" inputMode="decimal" value={dist} onChange={(e) => setDist(e.target.value)} />
            </div>
          )}
        </div>
        {metrics.has("elevation") && (
          <div>
            <label className="field-label" htmlFor="qe-el">Elevation gain (m)</label>
            <input id="qe-el" className="input num" inputMode="decimal" value={elev} onChange={(e) => setElev(e.target.value)} />
          </div>
        )}
        <fieldset>
          <legend className="field-label">Effort</legend>
          <div className="seg" role="group" aria-label="Effort">
            {EFFORT.map((e) => (
              <button key={e.value} type="button" aria-pressed={effort === e.value} onClick={() => setEffort(effort === e.value ? null : e.value)}>
                {e.label}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="field-label">How it felt</legend>
          <div className="grid grid-cols-5 gap-2">
            {FEEL.map((f) => (
              <button key={f.value} type="button" aria-pressed={feel === f.value} onClick={() => setFeel(feel === f.value ? null : f.value)} className={`press flex flex-col items-center gap-1 rounded-2xl border py-2.5 text-xs font-semibold ${feel === f.value ? "border-transparent bg-accent text-accent-ink" : "border-line text-muted"}`}>
                <FeelIcon value={f.value} size={24} weight={feel === f.value ? "fill" : "regular"} />
                {f.label}
              </button>
            ))}
          </div>
        </fieldset>
        <input className="input" placeholder="Title" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} aria-label="Title" />
        <textarea className="input" placeholder="Private notes" value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} aria-label="Private notes" />
        <button type="button" className="btn btn-primary h-13 w-full" onClick={save}>
          Save
        </button>
      </div>
    </div>
  );
}

