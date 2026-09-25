import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api, errorText } from "../lib/api";
import { queryClient } from "../lib/queries";
import { CalendarBlank, Minus, Plus } from "./phosphor";
import { toast } from "./toast";

interface Goal {
  month: string;
  goal: number | null;
  done: number;
  days_in_month: number;
  days_left: number;
  reachable: boolean;
}

/** A private target of active days for this month. Never ranked, never in
 * the streak - a shape for a quiet month. */
export function MonthlyGoalCard() {
  const q = useQuery({ queryKey: ["monthly-goal"], queryFn: () => api<Goal>("/me/monthly-goal") });
  const [editing, setEditing] = useState<number | null>(null);
  if (!q.data) return null;
  const g = q.data;
  const name = new Date(`${g.month}-01T00:00:00Z`).toLocaleDateString(undefined, { month: "long", timeZone: "UTC" });
  const save = async (days: number | null) => {
    try {
      if (days == null) await api(`/me/monthly-goal/${g.month}`, { method: "DELETE" });
      else await api("/me/monthly-goal", { method: "PUT", body: { month: g.month, days } });
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ["monthly-goal"] });
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  if (editing != null) {
    return (
      <section className="card p-4" aria-label={`${name} goal`}>
        <p className="font-semibold">Active days in {name}</p>
        <div className="mt-3 flex items-center justify-between rounded-2xl bg-surface-2 p-3">
          <button type="button" className="btn btn-secondary btn-icon" aria-label="Fewer days" onClick={() => setEditing(Math.max(1, editing - 1))}>
            <Minus size={16} />
          </button>
          <span className="num text-3xl font-semibold" aria-live="polite">
            {editing}
          </span>
          <button type="button" className="btn btn-secondary btn-icon" aria-label="More days" onClick={() => setEditing(Math.min(g.days_in_month, editing + 1))}>
            <Plus size={16} />
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          {g.goal != null && (
            <button type="button" className="btn btn-ghost" onClick={() => void save(null)}>
              Remove
            </button>
          )}
          <button type="button" className="btn btn-secondary flex-1" onClick={() => setEditing(null)}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary flex-1" onClick={() => void save(editing)}>
            Save
          </button>
        </div>
      </section>
    );
  }

  if (g.goal == null) {
    return (
      <button type="button" className="card press flex w-full items-center gap-3 p-4 text-left" onClick={() => setEditing(Math.min(12, g.days_in_month))}>
        <CalendarBlank size={22} className="text-dim" aria-hidden />
        <span className="flex-1">
          <span className="block font-semibold">Set a goal for {name}</span>
          <span className="block text-sm text-dim">
            {g.done} active day{g.done === 1 ? "" : "s"} so far. Private, just for you.
          </span>
        </span>
      </button>
    );
  }

  const pct = Math.min(100, (g.done / g.goal) * 100);
  const met = g.done >= g.goal;
  return (
    <section className="card p-4" aria-label={`${name} goal`}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-semibold">{name}</p>
        <button type="button" className="text-sm font-semibold text-accent-text" onClick={() => setEditing(g.goal)}>
          Edit
        </button>
      </div>
      <p className="num mt-1 text-2xl font-semibold tracking-tight">
        {g.done}
        <span className="text-base font-normal text-dim"> of {g.goal} active days</span>
      </p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuemin={0} aria-valuemax={g.goal} aria-valuenow={g.done} aria-label={`${g.done} of ${g.goal} days`}>
        <span className="block h-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-sm text-dim">
        {met ? "Goal met. Anything more is a bonus, including rest." : g.reachable ? `${g.goal - g.done} to go, ${g.days_left} days left.` : "Out of reach this month, and that's fine. Next month is a fresh one."}
      </p>
    </section>
  );
}
