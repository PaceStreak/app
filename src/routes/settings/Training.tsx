import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DisciplineIcon } from "../../components/icons";
import { Minus, Plus, Trash } from "../../components/phosphor";
import { Sheet } from "../../components/Sheet";
import { toast } from "../../components/toast";
import { Section, Segmented } from "../../components/ui";
import { api, errorText } from "../../lib/api";
import { WEEKDAYS } from "../../lib/dates";
import { queryClient, useLibrary } from "../../lib/queries";
import { useMe } from "../../lib/session";
import type { Chain } from "../../lib/types";
import { useProfilePatch } from "./useProfilePatch";

export function Training() {
  const me = useMe();
  const save = useProfilePatch();
  const lib = useLibrary();
  const chains = useQuery({ queryKey: ["chains"], queryFn: () => api<{ chains: Chain[] }>("/chains") });
  const [editing, setEditing] = useState<Chain | "new" | null>(null);
  const days = me.profile.training_days ?? 0;

  return (
    <div>
      <Section title="Streaks" className="mt-0">
        <p className="mb-3 text-sm text-dim">Your first streak is your main one. Changing a target applies from this week on; past weeks keep the target they were judged by.</p>
        <div className="card divide-y divide-line overflow-hidden">
          {(chains.data?.chains ?? []).map((c, i) => (
            <button key={c.id} type="button" className="press flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-2/60" onClick={() => setEditing(c)}>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">
                  {c.name}
                  {i === 0 && <span className="chip ml-2 h-5 px-1.5 text-[0.7rem]">Main</span>}
                </span>
                <span className="block truncate text-sm text-dim">
                  {c.target} days a week · {c.disciplines.length ? c.disciplines.map((d) => lib?.discipline(d)?.name ?? d).join(", ") : "Everything"}
                </span>
              </span>
              <span className="num text-sm text-muted">{c.current} wk</span>
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-secondary mt-3 w-full" onClick={() => setEditing("new")}>
          <Plus size={18} /> Add a streak
        </button>
      </Section>

      <Section title="Week">
        <p className="field-label">Weeks start on</p>
        <Segmented label="Week starts on" value={me.profile.week_starts_on} onChange={(v) => void save({ week_starts_on: v }, "Saved")} options={[{ value: 0, label: "Monday" }, { value: 6, label: "Sunday" }, { value: 5, label: "Saturday" }]} />
        <p className="field-label mt-5">Planned training days (optional)</p>
        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map((d, i) => {
            const on = (days & (1 << i)) !== 0;
            return (
              <button key={d} type="button" aria-pressed={on} className={`chip h-10 justify-center px-0 ${on ? "chip-accent" : ""}`} onClick={() => void save({ training_days: days ^ (1 << i) })}>
                {d.slice(0, 2)}
              </button>
            );
          })}
        </div>
        <p className="field-hint">Only used to time reminders. The streak always counts against your weekly target, whichever days you train.</p>
      </Section>

      <Section title="Units">
        <div className="grid grid-cols-2 gap-3">
          <Segmented label="Weight" value={me.profile.weight_unit} onChange={(v) => void save({ weight_unit: v })} options={[{ value: "kg", label: "kg" }, { value: "lb", label: "lb" }]} />
          <Segmented label="Distance" value={me.profile.distance_unit} onChange={(v) => void save({ distance_unit: v })} options={[{ value: "km", label: "km" }, { value: "mi", label: "mi" }]} />
        </div>
        <p className="field-hint">Everything is stored in kg and metres, so switching never changes your history or your records.</p>
      </Section>

      <Section title="Timezone">
        <p className="text-[0.95rem]">{me.profile.timezone}</p>
        <button
          type="button"
          className="btn btn-secondary btn-sm mt-2"
          onClick={() => void save({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }, "Timezone updated")}
        >
          Use this device's timezone
        </button>
        <p className="field-hint">Decides which day a session counts for. Past sessions keep the day they were logged on.</p>
      </Section>

      <ChainSheet chain={editing} onClose={() => setEditing(null)} onSaved={() => void chains.refetch()} isOnly={(chains.data?.chains.length ?? 0) <= 1} />
    </div>
  );
}

function ChainSheet({ chain, onClose, onSaved, isOnly }: { chain: Chain | "new" | null; onClose: () => void; onSaved: () => void; isOnly: boolean }) {
  const lib = useLibrary();
  const existing = chain && chain !== "new" ? chain : null;
  const [name, setName] = useState("");
  const [target, setTarget] = useState(3);
  const [disciplines, setDisciplines] = useState<string[]>([]);
  const [lastId, setLastId] = useState<string | null>(null);
  const key = chain === "new" ? "new" : (existing?.id ?? null);
  if (key !== lastId) {
    setLastId(key);
    setName(existing?.name ?? "");
    setTarget(existing?.target ?? 3);
    setDisciplines(existing?.disciplines ?? []);
  }
  const submit = async () => {
    try {
      if (existing) await api(`/chains/${existing.id}`, { method: "PATCH", body: { name, target, disciplines } });
      else await api("/chains", { body: { name: name || "New streak", target, disciplines } });
      await queryClient.invalidateQueries({ queryKey: ["stats"] });
      onSaved();
      onClose();
    } catch (err) {
      toast.error(errorText(err));
    }
  };
  const remove = async () => {
    if (!existing) return;
    try {
      await api(`/chains/${existing.id}`, { method: "DELETE" });
      await queryClient.invalidateQueries({ queryKey: ["stats"] });
      onSaved();
      onClose();
    } catch (err) {
      toast.error(errorText(err));
    }
  };
  return (
    <Sheet
      open={chain !== null}
      onClose={onClose}
      title={existing ? "Edit streak" : "New streak"}
      footer={
        <>
          {existing && !isOnly && (
            <button type="button" className="btn btn-danger btn-icon" aria-label="Archive streak" onClick={remove}>
              <Trash size={18} />
            </button>
          )}
          <button type="button" className="btn btn-primary flex-1" onClick={submit}>Save</button>
        </>
      }
    >
      <div className="space-y-5">
        <input className="input" placeholder="Name, e.g. Running" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} aria-label="Streak name" />
        <div className="flex items-center justify-between rounded-2xl bg-surface-2 p-4">
          <div>
            <p className="num text-3xl font-semibold">{target}</p>
            <p className="text-sm text-dim">days a week</p>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn btn-secondary btn-icon" aria-label="Fewer" onClick={() => setTarget(Math.max(1, target - 1))}>
              <Minus size={18} />
            </button>
            <button type="button" className="btn btn-secondary btn-icon" aria-label="More" onClick={() => setTarget(Math.min(7, target + 1))}>
              <Plus size={18} />
            </button>
          </div>
        </div>
        <div>
          <p className="field-label">Counts</p>
          <div className="grid grid-cols-3 gap-2">
            {lib?.lib.disciplines.map((d) => {
              const on = disciplines.includes(d.id);
              return (
                <button key={d.id} type="button" aria-pressed={on} onClick={() => setDisciplines(on ? disciplines.filter((x) => x !== d.id) : [...disciplines, d.id])} className={`press flex items-center gap-2 rounded-xl border px-2.5 py-2 text-sm ${on ? "border-transparent bg-accent text-accent-ink" : "border-line text-muted"}`}>
                  <DisciplineIcon id={d.id} size={16} /> <span className="truncate">{d.name}</span>
                </button>
              );
            })}
          </div>
          <p className="field-hint">{disciplines.length ? "Only these count toward this streak." : "Nothing picked: everything counts."}</p>
        </div>
      </div>
    </Sheet>
  );
}
