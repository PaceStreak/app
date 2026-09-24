import { useEffect, useState } from "react";
import { api, errorText } from "../lib/api";
import { queryClient, useLibrary } from "../lib/queries";
import type { Exercise } from "../lib/types";
import { Sheet } from "./Sheet";
import { toast } from "./toast";

export function CustomExerciseForm({
  open,
  onClose,
  onSaved,
  initialName = "",
  existing,
}: {
  open: boolean;
  onClose: () => void;
  onSaved?: (e: Exercise) => void;
  initialName?: string;
  existing?: Exercise;
}) {
  const lib = useLibrary();
  const [name, setName] = useState(existing?.name ?? initialName);
  const [pattern, setPattern] = useState(existing?.pattern ?? "push_h");
  const [equipment, setEquipment] = useState(existing?.equipment ?? "dumbbell");
  const [loadType, setLoadType] = useState<Exercise["load_type"]>(existing?.load_type ?? "weight");
  const [primary, setPrimary] = useState<string[]>(existing?.primary ?? []);
  const [rest, setRest] = useState(existing?.rest_sec ?? 90);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && !existing) setName(initialName);
  }, [open, initialName, existing]);

  const save = async () => {
    setBusy(true);
    try {
      const body = { name: name.trim(), pattern, equipment, load_type: loadType, primary, secondary: [], rest_sec: rest };
      const saved = existing
        ? await api<Exercise>(`/exercises/custom/${existing.id}`, { method: "PUT", body })
        : await api<Exercise>("/exercises/custom", { body });
      await queryClient.invalidateQueries({ queryKey: ["custom-exercises"] });
      onSaved?.(saved);
      onClose();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={existing ? "Edit exercise" : "New exercise"}
      footer={
        <button type="button" className="btn btn-primary w-full" disabled={busy || !name.trim()} onClick={save}>
          {busy ? "Saving…" : "Save exercise"}
        </button>
      }
    >
      <div className="space-y-5">
        <div>
          <label className="field-label" htmlFor="cx-name">Name</label>
          <input id="cx-name" className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label" htmlFor="cx-pattern">Movement</label>
            <select id="cx-pattern" className="input" value={pattern} onChange={(e) => setPattern(e.target.value)}>
              {Object.entries(lib?.lib.patterns ?? {}).map(([id, n]) => (
                <option key={id} value={id}>{n}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="cx-equipment">Equipment</label>
            <select id="cx-equipment" className="input" value={equipment} onChange={(e) => setEquipment(e.target.value)}>
              {Object.entries(lib?.lib.equipment ?? {}).map(([id, n]) => (
                <option key={id} value={id}>{n}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <p className="field-label">Logged as</p>
          <div className="seg" role="group" aria-label="How it is logged">
            {(
              [
                ["weight", "Weight × reps"],
                ["bodyweight", "Reps"],
                ["weighted_bw", "Added weight"],
                ["time", "Time"],
              ] as const
            ).map(([v, l]) => (
              <button key={v} type="button" aria-pressed={loadType === v} onClick={() => setLoadType(v)} className="px-1 text-xs sm:text-sm">
                {l}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="field-label">Main muscles</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(lib?.lib.muscles ?? {}).map(([id, n]) => {
              const on = primary.includes(id);
              return (
                <button key={id} type="button" aria-pressed={on} className={`chip h-8 ${on ? "chip-accent" : ""}`} onClick={() => setPrimary(on ? primary.filter((m) => m !== id) : [...primary, id].slice(0, 6))}>
                  {n}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <label className="field-label" htmlFor="cx-rest">Default rest (seconds)</label>
          <input id="cx-rest" className="input" inputMode="numeric" value={rest} onChange={(e) => setRest(Number(e.target.value.replace(/\D/g, "")) || 0)} />
        </div>
      </div>
    </Sheet>
  );
}
