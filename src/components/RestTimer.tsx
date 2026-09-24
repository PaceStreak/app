import { useCallback, useEffect, useRef, useState } from "react";
import { clock } from "../lib/units";
import { haptic, prefs } from "../lib/prefs";
import { localNotify } from "../lib/pwa";
import { Minus, Plus, X } from "./phosphor";

/** A rest countdown that survives backgrounding: it stores the end time,
 * not a ticking counter, so a locked phone comes back to the right number. */
export function useRestTimer() {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const [now, setNow] = useState(Date.now());
  const fired = useRef(false);

  useEffect(() => {
    if (endsAt == null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [endsAt]);

  const remaining = endsAt == null ? 0 : Math.max(0, (endsAt - now) / 1000);

  useEffect(() => {
    if (endsAt == null || remaining > 0 || fired.current) return;
    fired.current = true;
    haptic([180, 90, 180]);
    if (prefs.sound()) chime();
    if (document.visibilityState !== "visible") void localNotify("Rest's up", "Next set when you're ready.");
    const t = setTimeout(() => setEndsAt(null), 2500);
    return () => clearTimeout(t);
  }, [remaining, endsAt]);

  const start = useCallback((seconds: number) => {
    fired.current = false;
    setTotal(seconds);
    setNow(Date.now());
    setEndsAt(Date.now() + seconds * 1000);
  }, []);
  const add = useCallback((delta: number) => {
    setEndsAt((e) => (e == null ? e : Math.max(Date.now() + 1000, e + delta * 1000)));
    setTotal((t) => Math.max(1, t + delta));
  }, []);
  const stop = useCallback(() => setEndsAt(null), []);

  return { running: endsAt != null, remaining, total, start, add, stop };
}

let audio: AudioContext | null = null;
function chime() {
  try {
    audio ??= new AudioContext();
    const t = audio.currentTime;
    for (const [i, freq] of [880, 1320].entries()) {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.frequency.value = freq;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.0001, t + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.25, t + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.18 + 0.4);
      osc.connect(gain).connect(audio.destination);
      osc.start(t + i * 0.18);
      osc.stop(t + i * 0.18 + 0.45);
    }
  } catch {
    /* no audio: vibration and the number still say it */
  }
}

export function RestBar({ timer }: { timer: ReturnType<typeof useRestTimer> }) {
  if (!timer.running) return null;
  const done = timer.remaining <= 0;
  const progress = timer.total ? 1 - timer.remaining / timer.total : 1;
  return (
    <div className="rest-bar card-raised fixed inset-x-3 bottom-[calc(12px+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-[560px] items-center gap-3 p-2.5 pl-4" role="timer" aria-live="off" aria-label="Rest timer">
      <svg viewBox="0 0 36 36" className="size-10 shrink-0 -rotate-90" aria-hidden>
        <circle cx="18" cy="18" r="15" fill="none" stroke="var(--surface-3)" strokeWidth="4" />
        <circle
          cx="18"
          cy="18"
          r="15"
          fill="none"
          stroke={done ? "var(--accent)" : "var(--accent-text)"}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={94.2}
          strokeDashoffset={94.2 * (1 - progress)}
        />
      </svg>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-dim">{done ? "Rest's up" : "Rest"}</p>
        <p className="num text-2xl leading-none font-semibold tracking-tight">{clock(timer.remaining)}</p>
      </div>
      <button type="button" className="btn btn-secondary btn-icon btn-sm" onClick={() => timer.add(-15)} aria-label="15 seconds less">
        <Minus size={16} />
      </button>
      <button type="button" className="btn btn-secondary btn-icon btn-sm" onClick={() => timer.add(15)} aria-label="15 seconds more">
        <Plus size={16} />
      </button>
      <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={timer.stop} aria-label="Skip rest">
        <X size={18} />
      </button>
    </div>
  );
}
