import { useEffect, useState } from "react";
import { Pause, Play, Stop } from "./phosphor";
import { toast } from "./toast";
import { errorText, post } from "../lib/api";
import { queryClient } from "../lib/queries";
import type { Habit } from "../lib/types";

const KEY = (id: string) => `ps:focus:${id}`;

type State = { startedAt: number | null; banked: number };

function load(id: string): State {
  try {
    const raw = localStorage.getItem(KEY(id));
    if (raw) return JSON.parse(raw) as State;
  } catch {
    // Private mode or blocked storage: the timer still works, it just won't survive a reload.
  }
  return { startedAt: null, banked: 0 };
}

function store(id: string, s: State | null) {
  try {
    if (s) localStorage.setItem(KEY(id), JSON.stringify(s));
    else localStorage.removeItem(KEY(id));
  } catch {
    // As above.
  }
}

const clock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * A focus timer for a minutes habit. It keeps time from a stored start, not
 * a running count, so a locked phone or a closed tab loses nothing. Stop
 * adds the whole minutes to today.
 */
export function FocusTimer({ habit, today }: { habit: Habit; today: string }) {
  const [state, setState] = useState<State>(() => load(habit.id));
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const running = state.startedAt != null;

  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [running]);

  const update = (s: State) => {
    setState(s);
    store(habit.id, s);
  };
  const elapsed = state.banked + (state.startedAt != null ? now - state.startedAt : 0);
  const goal = (habit.daily_goal ?? 0) * 60_000;
  const left = goal - habit.today.amount * 60_000 - elapsed;

  const stop = async () => {
    const minutes = Math.floor(elapsed / 60_000);
    if (minutes < 1) {
      update({ startedAt: null, banked: 0 });
      store(habit.id, null);
      toast("Under a minute, so nothing was added");
      return;
    }
    setBusy(true);
    try {
      await post(`/habits/${habit.id}/days/${today}/add`, { amount: minutes });
      setState({ startedAt: null, banked: 0 });
      store(habit.id, null);
      for (const key of ["habits", "habit", "stats"]) void queryClient.invalidateQueries({ queryKey: [key] });
      toast.success(`Added ${minutes} min`);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card mt-4 flex items-center gap-4 p-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-dim">Focus timer</p>
        <p className="num text-3xl font-semibold" aria-live="off">
          {clock(elapsed)}
        </p>
        {goal > 0 && <p className="text-sm text-dim">{left > 0 ? `${clock(left)} to today's goal` : "Today's goal reached"}</p>}
      </div>
      {running ? (
        <button type="button" className="btn btn-icon" aria-label="Pause" onClick={() => update({ startedAt: null, banked: elapsed })}>
          <Pause size={20} weight="fill" />
        </button>
      ) : (
        <button type="button" className="btn btn-primary btn-icon" aria-label={elapsed ? "Resume" : "Start"} onClick={() => update({ startedAt: Date.now(), banked: state.banked })}>
          <Play size={20} weight="fill" />
        </button>
      )}
      {elapsed > 0 && (
        <button type="button" className="btn btn-icon" aria-label="Stop and add the minutes" disabled={busy} onClick={() => void stop()}>
          <Stop size={20} weight="fill" />
        </button>
      )}
    </div>
  );
}
