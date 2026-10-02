import { useMemo, useState } from "react";
import { MagnifyingGlass, Plus } from "./phosphor";
import { Sheet } from "./Sheet";
import { CustomExerciseForm } from "./CustomExerciseForm";
import { useGyms, useLibrary, useWorkouts } from "../lib/queries";
import { fuzzyMatch, substitutes } from "../lib/training";
import type { Exercise } from "../lib/types";

export function ExercisePicker({
  open,
  onClose,
  onPick,
  title = "Add exercise",
  similarTo,
  gymId,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (e: Exercise) => void;
  title?: string;
  /** When swapping: list stand-ins for this exercise first. */
  similarTo?: string;
  /** The gym this session is at, if any: offers "only what's here". */
  gymId?: string | null;
}) {
  const lib = useLibrary();
  const workouts = useWorkouts();
  const [q, setQ] = useState("");
  const [pattern, setPattern] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const gyms = useGyms();
  const gym = gyms.data?.find((g) => g.id === gymId) ?? gyms.data?.find((g) => g.is_default);
  const [atGym, setAtGym] = useState(true);
  const gymFilter = useMemo(() => (gym && gym.equipment.length && atGym ? new Set(gym.equipment) : null), [gym, atGym]);

  const recent = useMemo(() => {
    const seen: string[] = [];
    for (const w of workouts ?? []) for (const s of w.sets) if (!seen.includes(s.exercise_id)) seen.push(s.exercise_id);
    return seen.slice(0, 30);
  }, [workouts]);

  const results = useMemo(() => {
    if (!lib) return [];
    const term = q.trim().toLowerCase();
    const text = (e: Exercise) =>
      [e.name, ...e.aliases, ...e.primary.map((m) => lib.lib.muscles[m] ?? m), lib.lib.equipment[e.equipment] ?? ""].join(" ").toLowerCase();
    // Exact substring matches rank above typo-forgiving ones, and within
    // each, what you've done recently comes first.
    const exact = (e: Exercise) => !term || text(e).includes(term);
    const rank = (e: Exercise) => {
      const r = recent.indexOf(e.id);
      return (exact(e) ? 0 : 1000) + (r < 0 ? 100 : r);
    };
    return lib.exercises
      .filter((e) => !e.archived)
      .filter((e) => !pattern || e.pattern === pattern)
      .filter((e) => !gymFilter || e.custom || gymFilter.has(e.equipment))
      .filter((e) => !term || exact(e) || fuzzyMatch(term, text(e)))
      .sort((a, b) => {
        if (term || (!pattern && (recent.includes(a.id) || recent.includes(b.id)))) {
          const d = rank(a) - rank(b);
          if (d) return d;
        }
        return a.name.localeCompare(b.name);
      });
  }, [lib, q, pattern, recent, gymFilter]);

  // Stand-ins for a swap: the same movement pattern, most shared primary
  // muscles first, then the closest names.
  const similar = useMemo(() => {
    const from = similarTo ? lib?.byId.get(similarTo) : undefined;
    return lib && from ? substitutes(from, lib.exercises, gymFilter) : [];
  }, [lib, similarTo, gymFilter]);
  const showSimilar = similar.length > 0 && !q.trim() && !pattern;

  const row = (e: Exercise) => (
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
  );

  return (
    <>
      <Sheet open={open && !creating} onClose={onClose} title={title} size="full">
        <div className="sticky top-0 z-10 -mx-5 bg-surface px-5 pb-3">
          <div className="relative">
            <MagnifyingGlass size={18} className="absolute top-1/2 left-4 -translate-y-1/2 text-dim" />
            <input className="input pl-11" placeholder="Search exercises or muscles" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search exercises" />
          </div>
          <div className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1">
            {gym && gym.equipment.length > 0 && (
              <button type="button" aria-pressed={atGym} className={`chip h-8 whitespace-nowrap ${atGym ? "chip-accent" : ""}`} onClick={() => setAtGym(!atGym)}>
                At {gym.name}
              </button>
            )}
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
        {showSimilar && (
          <>
            <h3 className="mt-1 text-xs font-semibold tracking-wide text-dim uppercase">Similar</h3>
            <ul className="divide-y divide-line" aria-label="Similar exercises">
              {similar.map(row)}
            </ul>
            <h3 className="mt-4 text-xs font-semibold tracking-wide text-dim uppercase">Everything</h3>
          </>
        )}
        <ul className="divide-y divide-line">{results.map(row)}</ul>
        {results.length === 0 && (
          <p className="py-8 text-center text-muted">
            Nothing matches{q ? ` "${q}"` : ""}
            {gymFilter ? ` at ${gym!.name}` : ""}.
            {gymFilter && (
              <button type="button" className="ml-1 underline" onClick={() => setAtGym(false)}>
                Show everything
              </button>
            )}
          </p>
        )}
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
