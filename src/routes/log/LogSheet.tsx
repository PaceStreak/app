import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { DisciplineIcon } from "../../components/icons";
import { ArrowLeft, Barbell, CaretDown, ListBullets, Play } from "../../components/phosphor";
import { Sheet } from "../../components/Sheet";
import { toast } from "../../components/toast";
import { localDateOf, localToday, toLocalInput, uuid } from "../../lib/dates";
import { favouriteDisciplines, haptic } from "../../lib/prefs";
import { useLibrary, useRoutines, useWorkouts } from "../../lib/queries";
import { useMe } from "../../lib/session";
import { deleteWorkout, saveWorkout } from "../../lib/sync";
import { EFFORT, FEEL, blankWorkout, localWeek } from "../../lib/training";
import { parseDuration, parseNumber, pace, toMetres, type DistanceUnit } from "../../lib/units";
import type { Workout } from "../../lib/types";
import type { LogRequest } from "../../shell/LogContext";
import { FeelIcon } from "./FeelIcon";

const DURATIONS = [20, 30, 45, 60, 90];

export function LogSheet({ request, onClose }: { request: LogRequest | null; onClose: () => void }) {
  const [discipline, setDiscipline] = useState<string | null>(null);
  useEffect(() => {
    if (request) setDiscipline(request.discipline ?? null);
  }, [request]);
  return (
    <Sheet
      open={request !== null}
      onClose={onClose}
      title={discipline ? undefined : "Log a session"}
      size="md"
    >
      {request &&
        (discipline ? (
          <Details key={discipline} discipline={discipline} when={request.when} onBack={() => setDiscipline(null)} onDone={onClose} />
        ) : (
          <Chooser onPick={setDiscipline} onClose={onClose} />
        ))}
    </Sheet>
  );
}

function Chooser({ onPick, onClose }: { onPick: (d: string) => void; onClose: () => void }) {
  const lib = useLibrary();
  const workouts = useWorkouts();
  const routines = useRoutines();
  const navigate = useNavigate();

  // Most-used first: what you did recently, then what you said you do.
  const ordered = useMemo(() => {
    const all = lib?.lib.disciplines ?? [];
    const score = new Map<string, number>();
    (workouts ?? []).slice(0, 60).forEach((w, i) => score.set(w.discipline, (score.get(w.discipline) ?? 0) + (60 - i)));
    favouriteDisciplines().forEach((d) => score.set(d, (score.get(d) ?? 0) + 30));
    return [...all].sort((a, b) => (score.get(b.id) ?? 0) - (score.get(a.id) ?? 0));
  }, [lib, workouts]);

  const recentRoutines = (routines.data ?? [])
    .filter((r) => r.items.length)
    .sort((a, b) => (b.last_used_at ?? "").localeCompare(a.last_used_at ?? ""))
    .slice(0, 3);

  const go = (to: string) => {
    onClose();
    navigate(to);
  };

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {ordered.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => {
              haptic(6);
              onPick(d.id);
            }}
            className="press flex aspect-[1.1] flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-surface-2 text-sm font-semibold"
          >
            <DisciplineIcon id={d.id} size={28} />
            <span className="px-1 text-center leading-tight">{d.name}</span>
          </button>
        )) ?? null}
      </div>

      <div className="mt-5 space-y-2">
        <button type="button" onClick={() => go("/workouts/live")} className="press flex w-full items-center gap-3 rounded-2xl bg-accent-soft px-4 py-3.5 text-left">
          <span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-ink">
            <Play size={20} weight="fill" />
          </span>
          <span className="flex-1">
            <span className="block font-semibold">Start a workout</span>
            <span className="block text-sm text-muted">Sets, reps, rest timer, PRs as they happen.</span>
          </span>
        </button>
        {recentRoutines.map((r) => (
          <button key={r.id} type="button" onClick={() => go(`/workouts/live?routine=${r.id}`)} className="press flex w-full items-center gap-3 rounded-2xl border border-line px-4 py-3 text-left">
            <span className="grid size-10 place-items-center rounded-xl bg-surface-2">
              <Barbell size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{r.name}</span>
              <span className="block text-sm text-dim">{r.items.length} exercises</span>
            </span>
          </button>
        ))}
        <button type="button" onClick={() => go("/routines")} className="btn btn-ghost w-full">
          <ListBullets size={18} /> Routines
        </button>
      </div>
    </div>
  );
}

const WHEN = [
  { id: "now", label: "Now" },
  { id: "earlier", label: "Earlier today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "custom", label: "Pick a time" },
] as const;

function Details({ discipline, when, onBack, onDone }: { discipline: string; when?: string; onBack: () => void; onDone: () => void }) {
  const me = useMe();
  const lib = useLibrary();
  const workouts = useWorkouts();
  const navigate = useNavigate();
  const d = lib?.discipline(discipline);
  const metrics = new Set(d?.metrics ?? ["duration"]);
  const distanceUnit = me.profile.distance_unit as DistanceUnit;
  const today = localToday(me.profile.timezone);

  const [whenId, setWhenId] = useState<string>(when ?? "now");
  const [custom, setCustom] = useState(toLocalInput(new Date(Date.now() - 3600_000).toISOString()));
  const [minutes, setMinutes] = useState<number | null>(null);
  const [durationText, setDurationText] = useState("");
  const [distanceText, setDistanceText] = useState("");
  const [elevationText, setElevationText] = useState("");
  const [effort, setEffort] = useState<number | null>(null);
  const [feel, setFeel] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [more, setMore] = useState(false);
  const [saving, setSaving] = useState(false);

  const durationSec = durationText ? parseDuration(durationText) : minutes ? minutes * 60 : null;
  const distanceM = (() => {
    const v = parseNumber(distanceText);
    return v != null && v > 0 ? toMetres(v, distanceUnit) : null;
  })();

  const startedAt = (): Date => {
    const now = Date.now();
    const back = durationSec ? durationSec * 1000 : 0;
    if (whenId === "earlier") return new Date(now - Math.max(back, 2 * 3600_000));
    if (whenId === "yesterday") {
      const y = new Date(now - 86_400_000);
      y.setHours(18, 0, 0, 0);
      return y;
    }
    if (whenId === "custom") return new Date(custom);
    return new Date(now - back);
  };

  const save = async () => {
    setSaving(true);
    const start = startedAt();
    const workout: Workout = {
      ...blankWorkout(uuid(), discipline, start),
      local_date: localDateOf(start, me.profile.timezone),
      duration_sec: durationSec,
      distance_m: metrics.has("distance") ? distanceM : null,
      elevation_m: metrics.has("elevation") ? parseNumber(elevationText) : null,
      effort,
      feel,
      title: title.trim() || null,
      notes: notes.trim() || null,
    };
    const saved = await saveWorkout(workout);
    haptic([12, 30, 18]);
    const week = localWeek([saved, ...(workouts ?? [])], null, today, me.profile.week_starts_on);
    toast.success(`${d?.verb ?? "Logged"}. ${week.count} ${week.count === 1 ? "day" : "days"} this week.`, {
      body: navigator.onLine ? undefined : "Saved on this phone. It'll sync when you're back online.",
      action: { label: "Undo", onClick: () => void deleteWorkout(saved.id) },
    });
    onDone();
  };

  return (
    <div className="pb-2">
      <div className="-mt-1 mb-5 flex items-center gap-3">
        <button type="button" className="btn btn-ghost btn-icon -ml-3" onClick={onBack} aria-label="Pick a different activity">
          <ArrowLeft size={20} />
        </button>
        <span className="grid size-11 place-items-center rounded-2xl bg-accent text-accent-ink">
          <DisciplineIcon id={discipline} size={24} weight="fill" />
        </span>
        <h2 className="text-xl font-semibold tracking-tight">{d?.name ?? discipline}</h2>
      </div>

      {discipline === "strength" && (
        <button
          type="button"
          onClick={() => {
            onDone();
            navigate("/workouts/live");
          }}
          className="press mb-5 flex w-full items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3 text-left"
        >
          <Play size={20} weight="fill" className="text-accent-text" />
          <span className="flex-1 text-[0.95rem]">
            <span className="font-semibold">Track sets as you go</span>
            <span className="block text-sm text-dim">Or just save below - a session counts either way.</span>
          </span>
        </button>
      )}

      <fieldset>
        <legend className="field-label">When</legend>
        <div className="flex flex-wrap gap-2">
          {WHEN.map((o) => (
            <button key={o.id} type="button" aria-pressed={whenId === o.id} onClick={() => setWhenId(o.id)} className={`chip h-9 px-3.5 ${whenId === o.id ? "chip-accent" : ""}`}>
              {o.label}
            </button>
          ))}
        </div>
        {whenId === "custom" && (
          <input
            type="datetime-local"
            className="input mt-3"
            value={custom}
            max={toLocalInput(new Date().toISOString())}
            min={toLocalInput(new Date(Date.now() - 30 * 86_400_000).toISOString())}
            onChange={(e) => setCustom(e.target.value)}
            aria-label="Date and time"
          />
        )}
      </fieldset>

      {metrics.has("duration") && (
        <fieldset className="mt-5">
          <legend className="field-label">How long</legend>
          <div className="flex flex-wrap gap-2">
            {DURATIONS.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={minutes === m && !durationText}
                onClick={() => {
                  setMinutes(minutes === m ? null : m);
                  setDurationText("");
                }}
                className={`chip num h-9 px-3.5 ${minutes === m && !durationText ? "chip-accent" : ""}`}
              >
                {m < 60 ? `${m} min` : `${m / 60}${m % 60 ? ".5" : ""} h`}
              </button>
            ))}
            <input
              className="input h-9 min-h-0 w-28 rounded-full text-sm"
              placeholder="h:mm"
              inputMode="numeric"
              aria-label="Custom duration, minutes or h:mm"
              value={durationText}
              onChange={(e) => setDurationText(e.target.value.replace(/[^\d:]/g, ""))}
            />
          </div>
        </fieldset>
      )}

      {metrics.has("distance") && (
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div>
            <label className="field-label" htmlFor="log-distance">
              Distance
            </label>
            <div className="relative">
              <input id="log-distance" className="input pr-12" inputMode="decimal" placeholder="0" value={distanceText} onChange={(e) => setDistanceText(e.target.value)} />
              <span className="absolute inset-y-0 right-4 flex items-center text-sm text-dim">{distanceUnit}</span>
            </div>
          </div>
          <div className="flex flex-col justify-end pb-3 text-sm text-muted">
            {durationSec && distanceM ? (discipline === "run" || discipline === "walk" ? pace(durationSec, distanceM, distanceUnit) : "") : ""}
          </div>
        </div>
      )}

      <fieldset className="mt-5">
        <legend className="field-label">Effort</legend>
        <div className="seg" role="group" aria-label="Effort">
          {EFFORT.map((e) => (
            <button key={e.value} type="button" aria-pressed={effort === e.value} onClick={() => setEffort(effort === e.value ? null : e.value)}>
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
              aria-pressed={feel === f.value}
              onClick={() => setFeel(feel === f.value ? null : f.value)}
              className={`press flex flex-col items-center gap-1 rounded-2xl border py-2.5 text-xs font-semibold ${feel === f.value ? "border-transparent bg-accent text-accent-ink" : "border-line text-muted"}`}
            >
              <FeelIcon value={f.value} size={24} weight={feel === f.value ? "fill" : "regular"} />
              {f.label}
            </button>
          ))}
        </div>
      </fieldset>

      <button type="button" className="mt-5 flex items-center gap-1.5 text-sm font-semibold text-muted" aria-expanded={more} onClick={() => setMore(!more)}>
        <CaretDown size={14} className={`transition-transform duration-200 ${more ? "rotate-180" : ""}`} /> Title, notes{metrics.has("elevation") ? ", elevation" : ""}
      </button>
      {more && (
        <div className="mt-3 space-y-4">
          <input className="input" placeholder="Title (optional)" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Title" />
          {metrics.has("elevation") && (
            <input className="input" inputMode="decimal" placeholder="Elevation gain (m)" value={elevationText} onChange={(e) => setElevationText(e.target.value)} aria-label="Elevation gain in metres" />
          )}
          <textarea className="input" placeholder="Notes. Private: nobody else ever sees these." maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} aria-label="Private notes" />
        </div>
      )}

      <div className="sticky bottom-0 -mx-5 mt-6 bg-surface px-5 pt-3 pb-1">
        <button type="button" className="btn btn-primary h-14 w-full text-base" disabled={saving} onClick={save}>
          Save {d?.name.toLowerCase() ?? "session"}
        </button>
      </div>
    </div>
  );
}
