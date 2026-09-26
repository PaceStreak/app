import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";
import { api, errorText } from "../lib/api";
import { addDays, fmtFullDay, fmtMonthDay, localToday } from "../lib/dates";
import { queryClient } from "../lib/queries";
import { useMe } from "../lib/session";
import type { Plan, TrainingBlock } from "../lib/types";
import { Flag, Stack } from "./phosphor";
import { Sheet } from "./Sheet";
import { toast } from "./toast";
import { Segmented } from "./ui";

const RACES = [
  { value: "5k", label: "5 km", minWeeks: 4 },
  { value: "10k", label: "10 km", minWeeks: 5 },
  { value: "half", label: "Half", minWeeks: 8 },
  { value: "marathon", label: "Marathon", minWeeks: 12 },
] as const;

/** Train for a race: a date and a distance become a running plan, with a
 * taper and a recovery week, started straight away. */
export function RacePlanButton() {
  const me = useMe();
  const navigate = useNavigate();
  const today = localToday(me.profile.timezone);
  const [open, setOpen] = useState(false);
  const [race, setRace] = useState<(typeof RACES)[number]["value"]>("10k");
  const [date, setDate] = useState(addDays(today, 70));
  const [perWeek, setPerWeek] = useState(3);
  const [busy, setBusy] = useState(false);
  const spec = RACES.find((r) => r.value === race)!;
  const earliest = addDays(today, spec.minWeeks * 7);

  const create = async () => {
    setBusy(true);
    try {
      const plan = await api<Plan>("/plans/race", { body: { race, race_date: date, per_week: perWeek } });
      await Promise.all(["plans", "plan-active"].map((k) => queryClient.invalidateQueries({ queryKey: [k] })));
      toast.success("Plan started", { body: "Today shows each session. Easy means you could talk in sentences." });
      setOpen(false);
      navigate(`/plans/${plan.id}`);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className="btn btn-secondary mt-4 w-full" onClick={() => setOpen(true)}>
        <Flag size={18} /> Train for a race
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Train for a race"
        footer={
          <button type="button" className="btn btn-primary w-full" disabled={busy || date < earliest} onClick={() => void create()}>
            {busy ? "Building…" : "Build and start the plan"}
          </button>
        }
      >
        <div className="space-y-5">
          <div>
            <p className="field-label">Distance</p>
            <Segmented label="Distance" value={race} onChange={setRace} options={RACES.map((r) => ({ value: r.value, label: r.label }))} />
          </div>
          <div>
            <label className="field-label" htmlFor="race-date">Race day</label>
            <input id="race-date" type="date" className="input" value={date} min={earliest} onChange={(e) => setDate(e.target.value)} />
            <p className="field-hint">
              {date < earliest ? `A ${spec.label} plan needs at least ${spec.minWeeks} weeks: ${fmtFullDay(earliest)} or later.` : `${Math.round((Date.parse(date) - Date.parse(today)) / (7 * 86_400_000))} weeks away.`}
            </p>
          </div>
          <div>
            <p className="field-label">Runs a week</p>
            <Segmented label="Runs a week" value={perWeek} onChange={setPerWeek} options={[3, 4, 5].map((n) => ({ value: n, label: String(n) }))} />
          </div>
          <p className="text-sm text-muted">
            Mostly easy running, one faster session a week once a base is built, a lighter week every fourth, a taper before the race and a recovery week after. It replaces any plan that's running now.
          </p>
          <p className="text-xs text-dim">For healthy adults who can already run a little. Not coaching or medical advice.</p>
        </div>
      </Sheet>
    </>
  );
}

/**
 * Training blocks: reps in reserve step down each week, then a lighter week.
 * The live workout shows the week's target on every exercise and uses it for
 * suggestions when a routine doesn't set its own.
 */
export function BlockCard() {
  const q = useQuery({ queryKey: ["block-active"], queryFn: () => api<TrainingBlock | null>("/blocks/active") });
  const [open, setOpen] = useState(false);
  const [weeks, setWeeks] = useState(5);
  const [when, setWhen] = useState<"this" | "next">("this");
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["block-active"] });

  const start = async () => {
    try {
      await api("/blocks", { body: { weeks, when, rir_start: 3, rir_end: 1 } });
      await refresh();
      setOpen(false);
    } catch (err) {
      toast.error(errorText(err));
    }
  };
  const end = async (id: string) => {
    await api(`/blocks/${id}/end`, { method: "POST" });
    await refresh();
  };

  const b = q.data;
  return (
    <div className="card mt-6 p-4">
      <div className="flex items-start gap-3">
        <Stack size={22} className="mt-0.5 shrink-0 text-accent-text" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Strength training block</p>
          {b ? (
            <p className="text-sm text-muted">
              {b.now
                ? b.now.deload
                  ? `Lighter week, ${b.now.week} of ${b.now.weeks}: fewer sets, easy effort. Then start another block if you like.`
                  : `Week ${b.now.week} of ${b.now.weeks}: stop each set with about ${b.now.rir} ${b.now.rir === 1 ? "rep" : "reps"} in reserve.`
                : `Starts ${fmtMonthDay(b.starts_on)}.`}
            </p>
          ) : (
            <p className="text-sm text-muted">
              A few weeks where each week asks a little more (from 3 reps in reserve down to 1), then a lighter week to recover. Reps in reserve are the reps you could still have done.
            </p>
          )}
        </div>
      </div>
      {b ? (
        <button type="button" className="btn btn-ghost btn-sm mt-3 w-full text-dim" onClick={() => void end(b.id)}>
          End this block
        </button>
      ) : (
        <button type="button" className="btn btn-secondary btn-sm mt-3 w-full" onClick={() => setOpen(true)}>
          Start a block
        </button>
      )}
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Start a block"
        footer={
          <button type="button" className="btn btn-primary w-full" onClick={() => void start()}>
            Start
          </button>
        }
      >
        <div className="space-y-5">
          <div>
            <p className="field-label">Length, including the lighter last week</p>
            <Segmented label="Weeks" value={weeks} onChange={setWeeks} options={[4, 5, 6].map((n) => ({ value: n, label: `${n} weeks` }))} />
          </div>
          <div>
            <p className="field-label">Starting</p>
            <Segmented label="Starting" value={when} onChange={setWhen} options={[{ value: "this", label: "This week" }, { value: "next", label: "Next week" }]} />
          </div>
          <p className="text-sm text-muted">
            Week one leaves about 3 reps in reserve, the last hard week about 1, never to failure. Use your usual routines; each exercise shows the week's target.
          </p>
        </div>
      </Sheet>
    </div>
  );
}
