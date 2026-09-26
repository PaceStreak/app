import { useState } from "react";
import { useConfirm } from "../../components/Confirm";
import { Buildings, Plus, Trash } from "../../components/phosphor";
import { Sheet } from "../../components/Sheet";
import { toast } from "../../components/toast";
import { Empty, Field, Loading, Section, Switch } from "../../components/ui";
import { api, errorText } from "../../lib/api";
import { queryClient, useGyms, useLibrary } from "../../lib/queries";
import { useMe } from "../../lib/session";
import { PLATES_KG, PLATES_LB } from "../../lib/training";
import type { Gym } from "../../lib/types";
import { fromKg, toKg, type WeightUnit } from "../../lib/units";

type Draft = { id: string | null; name: string; equipment: string[]; plates: number[]; bar: number; is_default: boolean };

const BARS: Record<WeightUnit, number[]> = { kg: [20, 15, 10, 25], lb: [45, 35, 25, 55] };
// Plates in the person's own unit, rounded the way plates are labelled.
const display = (kg: number, unit: WeightUnit) => Math.round(fromKg(kg, unit) * 100) / 100;

/**
 * Where you train, and what's there. The exercise picker can narrow to a
 * gym's equipment and the plate calculator loads its plates - so a home
 * setup with two pairs of plates gets answers it can actually load.
 */
export function GymSettings() {
  const me = useMe();
  const unit = me.profile.weight_unit as WeightUnit;
  const gyms = useGyms();
  const lib = useLibrary();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmSheet, ask] = useConfirm();
  const allPlates = unit === "kg" ? PLATES_KG : PLATES_LB;

  const edit = (g?: Gym) =>
    setDraft(
      g
        ? { id: g.id, name: g.name, equipment: g.equipment, plates: g.plates_kg.map((p) => display(p, unit)), bar: display(g.bar_kg, unit), is_default: g.is_default }
        : { id: null, name: "", equipment: Object.keys(lib?.lib.equipment ?? {}), plates: [...allPlates], bar: BARS[unit][0], is_default: !(gyms.data ?? []).length },
    );

  const save = async () => {
    if (!draft) return;
    const body = { name: draft.name.trim(), equipment: draft.equipment, plates_kg: draft.plates.map((p) => toKg(p, unit)), bar_kg: toKg(draft.bar, unit), is_default: draft.is_default };
    try {
      if (draft.id) await api(`/gyms/${draft.id}`, { method: "PUT", body });
      else await api("/gyms", { body });
      setDraft(null);
      await queryClient.invalidateQueries({ queryKey: ["gyms"] });
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const remove = async (g: Gym) => {
    if (!(await ask({ title: `Delete ${g.name}?`, body: "Sessions logged there keep everything else; they just won't say where.", confirm: "Delete", danger: true }))) return;
    await api(`/gyms/${g.id}`, { method: "DELETE" });
    setDraft(null);
    await queryClient.invalidateQueries({ queryKey: ["gyms"] });
  };

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <div>
      <Section title="Your gyms" className="mt-0">
        {!gyms.data ? (
          <Loading />
        ) : gyms.data.length === 0 ? (
          <Empty title="No gyms yet" body="Add where you train and what it has. The exercise picker and plate calculator then fit the place." />
        ) : (
          <ul className="card divide-y divide-line">
            {gyms.data.map((g) => (
              <li key={g.id}>
                <button type="button" className="press flex w-full items-center gap-3 px-4 py-3.5 text-left" onClick={() => edit(g)}>
                  <Buildings size={22} className="shrink-0 text-dim" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{g.name}</span>
                    <span className="block truncate text-sm text-dim">
                      {g.equipment.length} kinds of equipment · {g.plates_kg.length ? `${g.plates_kg.length} plate sizes` : "no plates"}
                    </span>
                  </span>
                  {g.is_default && <span className="chip h-6 px-2 text-xs">Default</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="btn btn-secondary mt-3 w-full" onClick={() => edit()}>
          <Plus size={18} /> Add a gym
        </button>
      </Section>

      <Sheet
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? "Edit gym" : "New gym"}
        size="lg"
        footer={
          <div className="flex gap-2">
            {draft?.id && (
              <button type="button" className="btn btn-ghost btn-icon text-danger" aria-label="Delete gym" onClick={() => void remove(gyms.data!.find((g) => g.id === draft.id)!)}>
                <Trash size={20} />
              </button>
            )}
            <button type="button" className="btn btn-primary flex-1" disabled={!draft?.name.trim()} onClick={() => void save()}>
              Save
            </button>
          </div>
        }
      >
        {draft && (
          <div className="space-y-5">
            <Field label="Name" value={draft.name} maxLength={60} placeholder="Home, Work, Uni gym" onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <fieldset>
              <legend className="field-label">Equipment</legend>
              <div className="flex flex-wrap gap-2">
                {Object.entries(lib?.lib.equipment ?? {}).map(([id, name]) => (
                  <button key={id} type="button" aria-pressed={draft.equipment.includes(id)} className={`chip h-8 ${draft.equipment.includes(id) ? "chip-accent" : ""}`} onClick={() => setDraft({ ...draft, equipment: toggle(draft.equipment, id) })}>
                    {name}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="field-label">Plates ({unit}, per side)</legend>
              <div className="flex flex-wrap gap-2">
                {allPlates.map((p) => (
                  <button key={p} type="button" aria-pressed={draft.plates.includes(p)} className={`chip num h-8 ${draft.plates.includes(p) ? "chip-accent" : ""}`} onClick={() => setDraft({ ...draft, plates: toggle(draft.plates, p).sort((a, b) => b - a) })}>
                    {p}
                  </button>
                ))}
              </div>
            </fieldset>
            <div>
              <label className="field-label" htmlFor="gym-bar">Bar ({unit})</label>
              <select id="gym-bar" className="input" value={draft.bar} onChange={(e) => setDraft({ ...draft, bar: Number(e.target.value) })}>
                {[...new Set([draft.bar, ...BARS[unit]])].map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div className="card">
              <Switch checked={draft.is_default} onChange={(v) => setDraft({ ...draft, is_default: v })} label="My usual gym" description="New workouts start here." />
            </div>
          </div>
        )}
      </Sheet>
      {confirmSheet}
    </div>
  );
}
