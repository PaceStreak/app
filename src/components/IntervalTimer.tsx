import { useEffect, useMemo, useRef, useState } from "react";
import { buildPlan, positionAt, PRESETS, totalSeconds, type IntervalConfig, type IntervalMode, type PhaseKind } from "../lib/intervals";
import { localNotify } from "../lib/pwa";
import { haptic, prefs } from "../lib/prefs";
import { clock } from "../lib/units";
import { Minus, Pause, Play, Plus, Stop } from "./phosphor";
import { chime } from "./RestTimer";
import { Segmented } from "./ui";

const LABEL: Record<PhaseKind, string> = { prepare: "Get ready", work: "Work", rest: "Rest", done: "Done" };

type Run = { startedAt: number; pausedAt: number | null; pausedMs: number };

/**
 * Intervals, EMOM and Tabata. Position is always computed from the clock
 * (see lib/intervals.ts), so locking the phone mid-set never desynchronises
 * it; the screen is kept awake while it runs, where the browser allows.
 */
export function IntervalTimer() {
  const [config, setConfig] = useState<IntervalConfig>(PRESETS.intervals);
  const [run, setRun] = useState<Run | null>(null);
  const [now, setNow] = useState(Date.now());
  const plan = useMemo(() => buildPlan(config), [config]);

  const elapsed = run ? (run.pausedAt ?? now) - run.startedAt - run.pausedMs : 0;
  const pos = positionAt(plan, elapsed);
  const running = run !== null && run.pausedAt === null && pos.kind !== "done";

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [running]);

  useWakeLock(running);

  // Cues on phase changes and the last three seconds of each phase. Keyed on
  // (phase, second) so a cue fires once however many renders land in it.
  const cued = useRef<string>("");
  useEffect(() => {
    if (!run) return;
    const second = Math.ceil(pos.remaining);
    const key = `${pos.index}:${pos.kind === "done" ? "end" : second}`;
    if (key === cued.current) return;
    const phaseChanged = cued.current.split(":")[0] !== String(pos.index);
    cued.current = key;
    if (pos.kind === "done") {
      haptic([200, 100, 200, 100, 400]);
      if (prefs.sound()) chime("done");
      if (document.visibilityState !== "visible") void localNotify("Intervals done", `${pos.rounds} rounds. Nice work.`);
      return;
    }
    if (phaseChanged && pos.index > 0) {
      haptic(pos.kind === "work" ? [120, 60, 120] : [200]);
      if (prefs.sound()) chime("done");
    } else if (second <= 3 && second > 0 && pos.remaining < plan[pos.index].seconds - 0.5) {
      haptic(30);
      if (prefs.sound()) chime("tick");
    }
  }, [run, pos.index, pos.kind, pos.remaining, pos.rounds, plan]);

  const start = () => {
    cued.current = "";
    setNow(Date.now());
    setRun({ startedAt: Date.now(), pausedAt: null, pausedMs: 0 });
  };
  const pause = () => setRun((r) => (r ? { ...r, pausedAt: Date.now() } : r));
  const resume = () => {
    setNow(Date.now());
    setRun((r) => (r && r.pausedAt ? { ...r, pausedMs: r.pausedMs + (Date.now() - r.pausedAt), pausedAt: null } : r));
  };
  const stop = () => setRun(null);

  const pick = (mode: IntervalMode) => setConfig(PRESETS[mode]);
  const set = (patch: Partial<IntervalConfig>) => setConfig((c) => ({ ...c, ...patch }));

  if (run) {
    const tone = pos.kind === "work" ? "is-work" : pos.kind === "rest" ? "is-rest" : "";
    return (
      <div className={`interval-face card flex flex-col items-center p-8 text-center ${tone}`}>
        <p className="text-sm font-semibold tracking-wide uppercase" aria-live="assertive">
          {LABEL[pos.kind]}
        </p>
        <p className="num mt-2 text-8xl leading-none font-semibold tracking-tight" role="timer" aria-live="off">
          {clock(Math.ceil(pos.remaining))}
        </p>
        {pos.kind !== "done" && (
          <p className="mt-3 text-muted">
            {pos.round > 0 ? `Round ${pos.round} of ${pos.rounds}` : `${pos.rounds} rounds ahead`} · {clock(Math.ceil(pos.totalRemaining))} left
          </p>
        )}
        <div className="interval-bar mt-6 h-2 w-full overflow-hidden rounded-full bg-surface-3" aria-hidden>
          <span className="interval-fill block h-full" style={{ width: `${pos.progress * 100}%` }} />
        </div>
        <div className="mt-8 flex w-full gap-2">
          {pos.kind === "done" ? (
            <button type="button" className="btn btn-primary flex-1" onClick={stop}>
              Finish
            </button>
          ) : (
            <>
              <button type="button" className="btn btn-secondary flex-1" onClick={stop}>
                <Stop size={18} weight="fill" /> Stop
              </button>
              {run.pausedAt ? (
                <button type="button" className="btn btn-primary flex-1" onClick={resume}>
                  <Play size={18} weight="fill" /> Resume
                </button>
              ) : (
                <button type="button" className="btn btn-primary flex-1" onClick={pause}>
                  <Pause size={18} weight="fill" /> Pause
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <Segmented
        label="Interval type"
        value={config.mode}
        onChange={pick}
        options={[
          { value: "intervals", label: "Intervals" },
          { value: "emom", label: "EMOM" },
          { value: "tabata", label: "Tabata" },
        ]}
      />
      <div className="mt-5 space-y-3">
        {config.mode !== "emom" && <Stepper label="Work" value={config.work} step={5} min={5} max={900} format={clock} onChange={(work) => set({ work })} />}
        {config.mode !== "emom" && <Stepper label="Rest" value={config.rest} step={5} min={0} max={900} format={clock} onChange={(rest) => set({ rest })} />}
        <Stepper label={config.mode === "emom" ? "Minutes" : "Rounds"} value={config.rounds} step={1} min={1} max={99} format={String} onChange={(rounds) => set({ rounds })} />
      </div>
      <p className="mt-4 text-sm text-dim">
        {config.mode === "emom"
          ? "Start a set at the top of every minute. Whatever time is left is your rest."
          : config.mode === "tabata"
            ? "Classic Tabata: 20 seconds all-out, 10 seconds rest, 8 rounds."
            : "Work and rest on repeat."}{" "}
        Total {clock(totalSeconds(plan) - config.prepare)}, after a {config.prepare}-second countdown.
      </p>
      <button type="button" className="btn btn-primary mt-5 w-full" onClick={start}>
        <Play size={18} weight="fill" /> Start
      </button>
    </div>
  );
}

function Stepper({ label, value, step, min, max, format, onChange }: { label: string; value: number; step: number; min: number; max: number; format: (n: number) => string; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-3">
      <span className="font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <button type="button" className="btn btn-secondary btn-icon btn-sm" aria-label={`Less ${label.toLowerCase()}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))}>
          <Minus size={14} />
        </button>
        <span className="num w-14 text-center text-lg font-semibold" aria-live="polite">
          {format(value)}
        </span>
        <button type="button" className="btn btn-secondary btn-icon btn-sm" aria-label={`More ${label.toLowerCase()}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))}>
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

/** Keep the screen on while `active`. Re-acquired when the tab comes back,
 * because browsers release the lock whenever the page is hidden. */
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !prefs.keepAwake() || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let alive = true;
    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request("screen");
        if (!alive) void lock.release();
      } catch {
        /* denied or unsupported: the timer still works */
      }
    };
    const onVisible = () => document.visibilityState === "visible" && void acquire();
    void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => {});
    };
  }, [active]);
}
