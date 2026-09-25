import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useConfirm } from "../../components/Confirm";
import { ExercisePicker } from "../../components/ExercisePicker";
import { ArrowDown, ArrowUp, Play, Plus, Trash, X } from "../../components/phosphor";
import { toast } from "../../components/toast";
import { PageHeader } from "../../components/ui";
import { api, errorText } from "../../lib/api";
import { queryClient, useLibrary, useRoutines } from "../../lib/queries";
import { useMe } from "../../lib/session";
import type { Routine, RoutineItem } from "../../lib/types";
import { weight as fmtWeight, parseNumber, toKg, type WeightUnit } from "../../lib/units";

export default function RoutineEditor() {
  const { id = "new" } = useParams();
  const isNew = id === "new";
  const lib = useLibrary();
  const unit = useMe().profile.weight_unit as WeightUnit;
  const routines = useRoutines();
  const navigate = useNavigate();
  const [confirmSheet, ask] = useConfirm();
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<RoutineItem[]>([]);
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const r = routines.data?.find((x) => x.id === id);
    if (r) {
      setName(r.name);
      setNotes(r.notes ?? "");
      setItems(r.items);
    }
  }, [routines.data, id]);

  const patchItem = (i: number, patch: Partial<RoutineItem>) => setItems(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next);
  };

  const save = async (start = false) => {
    setBusy(true);
    try {
      const body = { name: name.trim() || "Routine", discipline: "strength", notes: notes.trim() || null, items };
      const saved = isNew ? await api<Routine>("/routines", { body }) : await api<Routine>(`/routines/${id}`, { method: "PUT", body });
      await queryClient.invalidateQueries({ queryKey: ["routines"] });
      if (start) navigate(`/workouts/live?routine=${saved.id}`);
      else {
        toast.success("Routine saved");
        navigate("/routines");
      }
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!(await ask({ title: "Delete this routine?", body: "Sessions you've already logged from it are kept.", confirm: "Delete", danger: true }))) return;
    await api(`/routines/${id}`, { method: "DELETE" });
    await queryClient.invalidateQueries({ queryKey: ["routines"] });
    navigate("/routines", { replace: true });
  };

  const num = (v: string) => (v === "" ? null : Number(v.replace(/\D/g, "")));

  return (
    <div>
      <PageHeader
        title={isNew ? "New routine" : "Edit routine"}
        back="/routines"
        action={
          !isNew && (
            <button type="button" className="btn btn-ghost btn-icon text-danger" aria-label="Delete routine" onClick={remove}>
              <Trash size={20} />
            </button>
          )
        }
      />
      <input className="input text-lg font-semibold" placeholder="Name, e.g. Upper A" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} aria-label="Routine name" />
      <div className="mt-4 space-y-3">
        {items.map((it, i) => (
          <div key={`${it.exercise_id}-${i}`} className="card p-4">
            <div className="flex items-center gap-2">
              <p className="min-w-0 flex-1 truncate font-semibold">{lib?.byId.get(it.exercise_id)?.name ?? "Exercise"}</p>
              <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label="Move up" onClick={() => move(i, -1)}>
                <ArrowUp size={16} />
              </button>
              <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label="Move down" onClick={() => move(i, 1)}>
                <ArrowDown size={16} />
              </button>
              <button type="button" className="btn btn-ghost btn-icon btn-sm text-dim" aria-label="Remove" onClick={() => setItems(items.filter((_, j) => j !== i))}>
                <X size={16} />
              </button>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {(
                [
                  ["Sets", "sets"],
                  ["Min reps", "reps_min"],
                  ["Max reps", "reps_max"],
                  ["RPE", "target_rpe"],
                ] as const
              ).map(([label, key]) => (
                <label key={key} className="text-xs text-dim">
                  {label}
                  <input
                    className="set-input num mt-1"
                    inputMode="numeric"
                    value={it[key] ?? ""}
                    onChange={(e) => patchItem(i, { [key]: key === "sets" ? Math.max(1, num(e.target.value) ?? 1) : num(e.target.value) } as Partial<RoutineItem>)}
                  />
                </label>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {lib?.byId.get(it.exercise_id)?.load_type === "weight" && (
                <label className="col-span-2 text-xs text-dim">
                  Start weight ({unit})
                  <input
                    className="set-input num mt-1"
                    inputMode="decimal"
                    placeholder="Optional"
                    // Uncontrolled: typing "2.5" must not be re-rounded through kg mid-keystroke.
                    defaultValue={it.weight_kg != null ? fmtWeight(it.weight_kg, unit, false) : ""}
                    onChange={(e) => {
                      const v = parseNumber(e.target.value);
                      patchItem(i, { weight_kg: v == null || v < 0 ? null : Math.round(toKg(v, unit) * 100) / 100 });
                    }}
                  />
                </label>
              )}
              <label className="col-span-2 text-xs text-dim">
                Rest (seconds)
                <input
                  className="set-input num mt-1"
                  inputMode="numeric"
                  placeholder={String(lib?.byId.get(it.exercise_id)?.rest_sec ?? 90)}
                  value={it.rest_sec ?? ""}
                  onChange={(e) => {
                    const v = num(e.target.value);
                    patchItem(i, { rest_sec: v == null ? null : Math.min(900, v) });
                  }}
                />
              </label>
            </div>
            <input
              className="input mt-2 text-sm"
              placeholder="Note, e.g. pause at the bottom"
              maxLength={140}
              value={it.note ?? ""}
              onChange={(e) => patchItem(i, { note: e.target.value || null })}
              aria-label={`Note for ${lib?.byId.get(it.exercise_id)?.name ?? "exercise"}`}
            />
          </div>
        ))}
      </div>
      <button type="button" className="btn btn-secondary mt-4 w-full" onClick={() => setPicker(true)}>
        <Plus size={18} /> Add exercise
      </button>
      <textarea className="input mt-4" placeholder="Notes" value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} aria-label="Notes" />
      <div className="mt-6 flex gap-3">
        <button type="button" className="btn btn-secondary flex-1" disabled={busy || !items.length} onClick={() => void save()}>
          Save
        </button>
        <button type="button" className="btn btn-primary flex-1" disabled={busy || !items.length} onClick={() => void save(true)}>
          <Play size={16} weight="fill" /> Save and start
        </button>
      </div>
      <ExercisePicker
        open={picker}
        onClose={() => setPicker(false)}
        onPick={(e) => {
          setItems([...items, { exercise_id: e.id, sets: 3, reps_min: 8, reps_max: 12, rest_sec: e.rest_sec, target_rpe: 8, note: null }]);
          setPicker(false);
        }}
      />
      {confirmSheet}
    </div>
  );
}
