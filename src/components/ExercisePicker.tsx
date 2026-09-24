import { useMemo, useState } from "react";
import { MagnifyingGlass, Plus } from "./phosphor";
import { Sheet } from "./Sheet";
import { CustomExerciseForm } from "./CustomExerciseForm";
import { useLibrary, useWorkouts } from "../lib/queries";
import type { Exercise } from "../lib/types";

export function ExercisePicker({
  open,
  onClose,
  onPick,
  title = "Add exercise",
}: {
  open: boolean;
  onClose: () => void;
  onPick: (e: Exercise) => void;
  title?: string;
}) {
  const lib = useLibrary();
  const workouts = useWorkouts();
  const [q, setQ] = useState("");
  const [pattern, setPattern] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const recent = useMemo(() => {
    const seen: string[] = [];
    for (const w of workouts ?? []) for (const s of w.sets) if (!seen.includes(s.exercise_id)) seen.push(s.exercise_id);
    return seen.slice(0, 8);
  }, [workouts]);

  const results = useMemo(() => {
    if (!lib) return [];
    const term = q.trim().toLowerCase();
    return lib.exercises
      .filter((e) => !e.archived)
      .filter((e) => !pattern || e.pattern === pattern)
      .filter(
        (e) =>
          !term ||
          e.name.toLowerCase().includes(term) ||
          e.aliases.some((a) => a.toLowerCase().includes(term)) ||
          e.primary.some((m) => (lib.lib.muscles[m] ?? m).toLowerCase().includes(term)) ||
          (lib.lib.equipment[e.equipment] ?? "").toLowerCase().includes(term),
      )
      .sort((a, b) => {
        const ra = recent.indexOf(a.id);
        const rb = recent.indexOf(b.id);
        if (!term && !pattern && (ra >= 0 || rb >= 0)) return (ra < 0 ? 99 : ra) - (rb < 0 ? 99 : rb);
        return a.name.localeCompare(b.name);
      });
  }, [lib, q, pattern, recent]);

  return (
    <>
      <Sheet open={open && !creating} onClose={onClose} title={title} size="full">
        <div className="sticky top-0 z-10 -mx-5 bg-surface px-5 pb-3">
          <div className="relative">
            <MagnifyingGlass size={18} className="absolute top-1/2 left-4 -translate-y-1/2 text-dim" />
            <input className="input pl-11" placeholder="Search exercises or muscles" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search exercises" />
          </div>
          <div className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1">
            <button type="button" className={`chip h-8 ${pattern === null ? "chip-accent" : ""}`} onClick={() => setPattern(null)}>
              All
            </button>
            {Object.entries(lib?.lib.patterns ?? {}).map(([id, name]) => (
              <button key={id} type="button" className={`chip h-8 ${pattern === id ? "chip-accent" : ""}`} onClick={() => setPattern(pattern === id ? null : id)}>
                {name}
              </button>
            ))}
          </div>
        </div>
        <ul className="divide-y divide-line">
          {results.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                className="press flex w-full items-center gap-3 py-3 text-left"
                onClick={() => {
                  onPick(e);
                  setQ("");
                }}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {e.name}
                    {e.custom && <span className="chip ml-2 h-5 px-1.5 text-[0.7rem]">Yours</span>}
                  </span>
                  <span className="block truncate text-sm text-dim">
                    {e.primary.map((m) => lib?.lib.muscles[m] ?? m).join(", ")} · {lib?.lib.equipment[e.equipment] ?? e.equipment}
                  </span>
                </span>
                <Plus size={18} className="shrink-0 text-dim" />
              </button>
            </li>
          ))}
        </ul>
        {results.length === 0 && <p className="py-8 text-center text-muted">Nothing matches "{q}".</p>}
        <button type="button" className="btn btn-secondary mt-4 w-full" onClick={() => setCreating(true)}>
          <Plus size={18} /> Create your own{q ? `: "${q}"` : ""}
        </button>
      </Sheet>
      <CustomExerciseForm
        open={creating}
        initialName={q}
        onClose={() => setCreating(false)}
        onSaved={(e) => {
          setCreating(false);
          onPick(e);
        }}
      />
    </>
  );
}
