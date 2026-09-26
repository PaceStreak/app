import { useMemo } from "react";
import { fmtMonthDay } from "../lib/dates";
import { trainingLoad } from "../lib/load";
import { useWorkouts } from "../lib/queries";
import { BarChart } from "./BarChart";
import { Section } from "./ui";

const STATE = {
  new: { title: "Building a baseline", body: "Three weeks of sessions and this compares each week with your usual." },
  easing: { title: "Easier than usual", body: "A lighter stretch. Good after a hard block, or a sign life got busy." },
  steady: { title: "Steady", body: "About your usual. The sweet spot for building fitness without niggles." },
  building: { title: "Building", body: "A bit more than usual. Fine for a week or two; keep the easy days easy." },
  spike: { title: "A big jump", body: "Well above your last four weeks. Jumps like this are when niggles start, so an easier day or two helps." },
} as const;

/**
 * Training load: minutes x effort per week, and this week against the last
 * four. It's for spotting sudden jumps, not for chasing a bigger number, so
 * it has no target, no record and no leaderboard.
 */
export function LoadCard({ today }: { today: string }) {
  const workouts = useWorkouts();
  const load = useMemo(() => (workouts ? trainingLoad(workouts, today) : null), [workouts, today]);
  if (!load || load.weeks.every((w) => w.load === 0)) return null;
  const state = STATE[load.state];
  const current = load.weeks.length - 1;
  return (
    <Section title="Training load">
      <div id="load" className="card p-4">
        <p className="font-semibold">{state.title}</p>
        <p className="text-sm text-muted">
          {state.body}
          {load.ratio != null && ` This week is ${Math.round(load.ratio * 100)}% of your recent weekly average.`}
        </p>
        <div className="mt-4">
          <BarChart
            title="Training load by week"
            bars={load.weeks.map((w, i) => ({ key: w.start, label: fmtMonthDay(w.start), value: w.load, display: `${w.load} load`, dim: i === current }))}
            target={load.chronic || null}
            targetLabel="Your four-week average"
          />
        </div>
        <p className="mt-3 text-xs text-dim">Minutes times how hard each session felt (1-10); sessions without an effort rating count as 5.</p>
      </div>
    </Section>
  );
}
