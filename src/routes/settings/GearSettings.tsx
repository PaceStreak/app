import { useState } from "react";
import { useConfirm } from "../../components/Confirm";
import { Bicycle, Package, Plus, Sneaker, Trash } from "../../components/phosphor";
import { Sheet } from "../../components/Sheet";
import { toast } from "../../components/toast";
import { Empty, Field, Loading, Section, Segmented } from "../../components/ui";
import { api, errorText } from "../../lib/api";
import { fmtMonthDay } from "../../lib/dates";
import { queryClient, useGear, useLibrary } from "../../lib/queries";
import { useMe } from "../../lib/session";
import type { Gear } from "../../lib/types";
import { distance, fromMetres, toMetres } from "../../lib/units";

const ICON = { shoes: Sneaker, bike: Bicycle, other: Package } as const;

type Draft = { id: string | null; name: string; kind: Gear["kind"]; default_for: string[]; limit: string; initial: string; note: string };

/** Shoes, bikes and anything else that wears out. Private; never ranked. */
export function GearSettings() {
  const me = useMe();
  const du = me.profile.distance_unit;
  const gear = useGear();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmSheet, ask] = useConfirm();
  const active = (gear.data ?? []).filter((g) => !g.retired);
  const retired = (gear.data ?? []).filter((g) => g.retired);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["gear"] });
  const toDisplay = (km: number | null) => (km == null ? "" : String(Math.round(fromMetres(km * 1000, du) * 10) / 10));
  const toKm = (v: string) => {
    const n = Number(v.replace(",", "."));
    return v.trim() && Number.isFinite(n) && n > 0 ? toMetres(n, du) / 1000 : null;
  };

  const edit = (g?: Gear) =>
    setDraft(
      g
        ? { id: g.id, name: g.name, kind: g.kind, default_for: g.default_for, limit: toDisplay(g.limit_km), initial: toDisplay(g.initial_km || null), note: g.note ?? "" }
        : { id: null, name: "", kind: "shoes", default_for: ["run"], limit: du === "km" ? "700" : "450", initial: "", note: "" },
    );

  const save = async () => {
    if (!draft) return;
    const body = { name: draft.name.trim(), kind: draft.kind, default_for: draft.default_for, limit_km: toKm(draft.limit), initial_km: toKm(draft.initial) ?? 0, note: draft.note.trim() || null };
    try {
      if (draft.id) await api(`/gear/${draft.id}`, { method: "PATCH", body });
      else await api("/gear", { body });
      setDraft(null);
      await refresh();
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const retire = async (g: Gear, retired: boolean) => {
    try {
      await api(`/gear/${g.id}`, { method: "PATCH", body: { retired } });
      toast.success(retired ? `${g.name} retired` : `${g.name} is back in use`);
      setDraft(null);
      await refresh();
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const remove = async (g: Gear) => {
    if (!(await ask({ title: `Delete ${g.name}?`, body: "Sessions that used it stay exactly as they are; they just won't name it any more. Retiring keeps the history instead.", confirm: "Delete", danger: true }))) return;
    try {
      await api(`/gear/${g.id}`, { method: "DELETE" });
      setDraft(null);
      await refresh();
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  if (!gear.data) return <Loading />;

  return (
    <div>
      <p className="text-muted">Track how far your shoes and bikes have gone, from the sessions you log with them. Only you can see this.</p>
      {active.length === 0 && retired.length === 0 ? (
        <Empty icon={<Sneaker size={26} />} title="No gear yet" body="Add a pair of shoes and runs will count toward them automatically." />
      ) : (
        <Section title="In use">
          <ul className="card divide-y divide-line">
            {active.map((g) => (
              <GearRow key={g.id} g={g} du={du} onOpen={() => edit(g)} />
            ))}
          </ul>
        </Section>
      )}
      <button type="button" className="btn btn-secondary mt-4 w-full" onClick={() => edit()}>
        <Plus size={18} /> Add gear
      </button>
      {retired.length > 0 && (
        <Section title="Retired">
          <ul className="card divide-y divide-line">
            {retired.map((g) => (
              <GearRow key={g.id} g={g} du={du} onOpen={() => edit(g)} />
            ))}
          </ul>
        </Section>
      )}

      <GearSheet draft={draft} setDraft={setDraft} onSave={save} existing={draft?.id ? (gear.data ?? []).find((g) => g.id === draft.id) : undefined} onRetire={retire} onDelete={remove} du={du} />
      {confirmSheet}
    </div>
  );
}

function GearRow({ g, du, onOpen }: { g: Gear; du: "km" | "mi"; onOpen: () => void }) {
  const Icon = ICON[g.kind];
  const due = g.worn != null && g.worn >= 1;
  const near = g.worn != null && g.worn >= 0.85 && !due;
  return (
    <li>
      <button type="button" className="press flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2/60" onClick={onOpen}>
        <Icon size={22} className={g.retired ? "text-dim" : "text-accent-text"} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{g.name}</span>
          <span className="block text-sm text-dim">
            {g.sessions} session{g.sessions === 1 ? "" : "s"}
            {g.last_used ? ` · last ${fmtMonthDay(g.last_used)}` : ""}
            {due && !g.retired && <span className="font-semibold text-flame-text"> · due for replacement</span>}
            {near && !g.retired && <span className="text-flame-text"> · nearly due</span>}
          </span>
          {g.worn != null && !g.retired && (
            <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-surface-3" aria-hidden>
              <span className={`block h-full ${due || near ? "bg-flame" : "bg-accent"}`} style={{ width: `${Math.min(100, g.worn * 100)}%` }} />
            </span>
          )}
        </span>
        <span className="num shrink-0 text-right">
          <span className="block font-semibold">{distance(g.distance_m, du)}</span>
          {g.limit_km != null && <span className="block text-xs text-dim">of {distance(g.limit_km * 1000, du)}</span>}
        </span>
      </button>
    </li>
  );
}

function GearSheet({
  draft,
  setDraft,
  onSave,
  existing,
  onRetire,
  onDelete,
  du,
}: {
  draft: Draft | null;
  setDraft: (d: Draft | null) => void;
  onSave: () => void;
  existing?: Gear;
  onRetire: (g: Gear, retired: boolean) => void;
  onDelete: (g: Gear) => void;
  du: "km" | "mi";
}) {
  const lib = useLibrary();
  return (
    <Sheet
      open={draft !== null}
      onClose={() => setDraft(null)}
      title={draft?.id ? "Edit gear" : "Add gear"}
      footer={
        draft && (
          <>
            {existing && (
              <button type="button" className="btn btn-danger btn-icon" aria-label={`Delete ${existing.name}`} onClick={() => onDelete(existing)}>
                <Trash size={18} />
              </button>
            )}
            {existing && (
              <button type="button" className="btn btn-secondary" onClick={() => onRetire(existing, !existing.retired)}>
                {existing.retired ? "Un-retire" : "Retire"}
              </button>
            )}
            <button type="button" className="btn btn-primary flex-1" disabled={!draft.name.trim()} onClick={onSave}>
              Save
            </button>
          </>
        )
      }
    >
      {draft && (
        <div className="space-y-4">
          <Segmented
            label="Kind"
            value={draft.kind}
            onChange={(kind) => setDraft({ ...draft, kind })}
            options={[
              { value: "shoes", label: "Shoes" },
              { value: "bike", label: "Bike" },
              { value: "other", label: "Other" },
            ]}
          />
          <Field label="Name" required maxLength={60} placeholder="e.g. Trail shoes" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Replace at (${du})`} inputMode="decimal" value={draft.limit} onChange={(e) => setDraft({ ...draft, limit: e.target.value })} hint="Optional reminder." />
            <Field label={`Already done (${du})`} inputMode="decimal" value={draft.initial} onChange={(e) => setDraft({ ...draft, initial: e.target.value })} hint="Before you added it." />
          </div>
          <fieldset>
            <legend className="field-label">Use by default for</legend>
            <div className="flex flex-wrap gap-1.5">
              {(lib?.lib.disciplines ?? []).map((d) => {
                const on = draft.default_for.includes(d.id);
                return (
                  <button key={d.id} type="button" aria-pressed={on} className={`press chip ${on ? "chip-accent" : ""}`} onClick={() => setDraft({ ...draft, default_for: on ? draft.default_for.filter((x) => x !== d.id) : [...draft.default_for, d.id] })}>
                    {d.name}
                  </button>
                );
              })}
            </div>
            <p className="field-hint">New sessions of these pick this gear. One default per discipline; choosing one here moves it from other gear.</p>
          </fieldset>
          <Field label="Note" maxLength={200} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
        </div>
      )}
    </Sheet>
  );
}
