import { useMemo, useState } from "react";
import { Link } from "react-router";
import { CustomExerciseForm } from "../../components/CustomExerciseForm";
import { CaretRight, MagnifyingGlass, Plus } from "../../components/phosphor";
import { PageHeader } from "../../components/ui";
import { useLibrary, useWorkouts } from "../../lib/queries";

export default function Exercises() {
  const lib = useLibrary();
  const workouts = useWorkouts();
  const [q, setQ] = useState("");
  const [pattern, setPattern] = useState<string | null>(null);
  const [mine, setMine] = useState(false);
  const [creating, setCreating] = useState(false);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const w of workouts ?? []) for (const id of new Set(w.sets.map((s) => s.exercise_id))) m.set(id, (m.get(id) ?? 0) + 1);
    return m;
  }, [workouts]);

  const rows = (lib?.exercises ?? [])
    .filter((e) => !e.archived)
    .filter((e) => !mine || counts.has(e.id) || e.custom)
    .filter((e) => !pattern || e.pattern === pattern)
    .filter((e) => {
      const t = q.trim().toLowerCase();
      return !t || e.name.toLowerCase().includes(t) || e.primary.some((m) => (lib?.lib.muscles[m] ?? "").toLowerCase().includes(t));
    })
    .sort((a, b) => (mine ? (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) : a.name.localeCompare(b.name)));

  return (
    <div>
      <PageHeader
        title="Exercises"
        back="/you"
        action={
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setCreating(true)}>
            <Plus size={16} /> New
          </button>
        }
      />
      <div className="relative">
        <MagnifyingGlass size={18} className="absolute top-1/2 left-4 -translate-y-1/2 text-dim" />
        <input className="input pl-11" placeholder="Search by name or muscle" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search exercises" />
      </div>
      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
        <button type="button" className={`chip h-8 ${mine ? "chip-accent" : ""}`} onClick={() => setMine(!mine)}>
          Yours
        </button>
        {Object.entries(lib?.lib.patterns ?? {}).map(([id, n]) => (
          <button key={id} type="button" className={`chip h-8 ${pattern === id ? "chip-accent" : ""}`} onClick={() => setPattern(pattern === id ? null : id)}>
            {n}
          </button>
        ))}
      </div>
      <ul className="card mt-4 divide-y divide-line overflow-hidden">
        {rows.map((e) => (
          <li key={e.id}>
            <Link to={`/exercises/${e.id}`} className="press flex items-center gap-3 px-4 py-3 hover:bg-surface-2/60">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{e.name}</span>
                <span className="block truncate text-sm text-dim">
                  {e.primary.map((m) => lib?.lib.muscles[m] ?? m).join(", ")}
                  {counts.get(e.id) ? ` · ${counts.get(e.id)} sessions` : ""}
                </span>
              </span>
              {e.custom && <span className="chip h-6 px-2 text-xs">Yours</span>}
              <CaretRight size={16} className="text-dim" />
            </Link>
          </li>
        ))}
        {rows.length === 0 && <li className="px-4 py-10 text-center text-muted">Nothing matches.</li>}
      </ul>
      <CustomExerciseForm open={creating} initialName={q} onClose={() => setCreating(false)} />
    </div>
  );
}
