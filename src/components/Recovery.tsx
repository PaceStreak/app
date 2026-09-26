import { useMemo } from "react";
import { useLibrary, useWorkouts } from "../lib/queries";
import { muscleRecovery } from "../lib/training";
import { Section } from "./ui";

const STATES = [
  { max: 1, label: "Just worked", cls: "bg-accent text-accent-ink" },
  { max: 3, label: "Recovering", cls: "bg-accent-soft text-ink" },
  { max: Infinity, label: "Fresh", cls: "bg-surface-2 text-muted" },
] as const;

/**
 * A rough recovery map: each muscle by how long since it last did primary
 * work, with this week's hard sets. It says what was trained when - not how
 * recovered anyone is; sleep, food and soreness decide that, and the copy
 * says so.
 */
export function Recovery({ today }: { today: string }) {
  const lib = useLibrary();
  const workouts = useWorkouts();
  const map = useMemo(() => (lib && workouts ? muscleRecovery(workouts, lib.byId, today) : null), [lib, workouts, today]);
  if (!lib || !map || map.size === 0) return null;
  const muscles = Object.entries(lib.lib.muscles).sort(([a], [b]) => (map.get(a)?.daysSince ?? 999) - (map.get(b)?.daysSince ?? 999));
  return (
    <Section title="Recovery map">
      <div className="card p-4">
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {muscles.map(([id, name]) => {
            const m = map.get(id);
            const state = m ? STATES.find((s) => m.daysSince <= s.max)! : null;
            return (
              <li key={id} className={`rounded-xl px-3 py-2 ${state ? state.cls : "bg-surface-2 text-dim"}`}>
                <span className="block truncate text-sm font-medium">{name}</span>
                <span className="num block text-xs opacity-80">
                  {!m ? "Not trained yet" : m.daysSince === 0 ? "Today" : m.daysSince === 1 ? "Yesterday" : `${m.daysSince} days ago`}
                  {m && m.sets7 > 0 ? ` · ${m.sets7} sets this week` : ""}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-dim" aria-hidden>
          {STATES.map((s) => (
            <span key={s.label} className="flex items-center gap-1.5">
              <span className={`inline-block size-3 rounded ${s.cls}`} /> {s.label}
            </span>
          ))}
        </div>
        <p className="mt-3 text-xs text-dim">From what you've logged, by main muscle worked. How recovered you actually feel matters more than any count.</p>
      </div>
    </Section>
  );
}
