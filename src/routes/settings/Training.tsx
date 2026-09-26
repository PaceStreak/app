import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DisciplineIcon } from "../../components/icons";
import { Minus, Plus, Trash, X } from "../../components/phosphor";
import { Sheet } from "../../components/Sheet";
import { toast } from "../../components/toast";
import { Section, Segmented } from "../../components/ui";
import { api, errorText } from "../../lib/api";
import { WEEKDAYS } from "../../lib/dates";
import { queryClient, useLibrary } from "../../lib/queries";
import { useMe } from "../../lib/session";
import type { Chain } from "../../lib/types";
import { PauseSection } from "./PauseSection";
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

      <Section title="Whole-life streak">
        <div id="life">
          <p className="text-sm text-muted">
            An extra streak across everything: a day counts with any training or any habit done. Your training streak and each habit's own streak stay as they are.
          </p>
          <p className="field-label mt-4">Days a week to keep it</p>
          <div className="grid grid-cols-8 gap-1.5">
            <button type="button" aria-pressed={!me.profile.life_target} className={`chip h-10 justify-center px-0 text-xs ${!me.profile.life_target ? "chip-accent" : ""}`} onClick={() => void save({ life_target: null }, "Whole-life streak off")}>
              Off
            </button>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <button key={n} type="button" aria-pressed={me.profile.life_target === n} className={`chip num h-10 justify-center px-0 ${me.profile.life_target === n ? "chip-accent" : ""}`} onClick={() => void save({ life_target: n }, "Saved")}>
                {n}
              </button>
            ))}
          </div>
        </div>
      </Section>

      <PauseSection />

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
        <p className="field-hint">Used to time reminders and to mark the other days as planned rest on your grid. The streak always counts against your weekly target, whichever days you train.</p>
      </Section>

      <Section title="Heart rate">
        <MaxHrField value={me.profile.max_hr ?? null} birthYear={me.profile.birth_year} onSave={(v) => void save({ max_hr: v }, "Saved")} />
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
  const [reqs, setReqs] = useState<{ disciplines: string[]; days: number }[]>([]);
  const [lastId, setLastId] = useState<string | null>(null);
  const key = chain === "new" ? "new" : (existing?.id ?? null);
  if (key !== lastId) {
    setLastId(key);
    setName(existing?.name ?? "");
    setTarget(existing?.target ?? 3);
    setDisciplines(existing?.disciplines ?? []);
    setReqs((existing?.requirements ?? []).map(({ disciplines, days }) => ({ disciplines, days })));
  }
  // Requirements can only name disciplines this streak counts.
  const countable = (lib?.lib.disciplines ?? []).filter((d) => !disciplines.length || disciplines.includes(d.id));
  const required = reqs.reduce((n, r) => n + r.days, 0);
  const reqsValid = reqs.every((r) => r.disciplines.length > 0) && required <= target;
  const submit = async () => {
    try {
      const requirements = reqs.map((r) => ({ ...r, disciplines: r.disciplines.filter((d) => !disciplines.length || disciplines.includes(d)) }));
      if (existing) await api(`/chains/${existing.id}`, { method: "PATCH", body: { name, target, disciplines, requirements } });
      else await api("/chains", { body: { name: name || "New streak", target, disciplines, requirements } });
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
          <button type="button" className="btn btn-primary flex-1" disabled={!reqsValid} onClick={submit}>Save</button>
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
        <fieldset>
          <legend className="field-label">Must include (optional)</legend>
          <p className="mb-3 text-sm text-dim">For a balanced week, e.g. at least 2 of your days are runs and 1 is strength. Applies from this week on.</p>
          <ul className="space-y-3">
            {reqs.map((r, i) => (
              <li key={i} className="rounded-2xl bg-surface-2 p-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted">At least</span>
                  <button type="button" className="btn btn-secondary btn-icon btn-sm" aria-label="Fewer days" onClick={() => setReqs(reqs.map((x, j) => (j === i ? { ...x, days: Math.max(1, x.days - 1) } : x)))}>
                    <Minus size={14} />
                  </button>
                  <span className="num w-5 text-center font-semibold" aria-live="polite">{r.days}</span>
                  <button type="button" className="btn btn-secondary btn-icon btn-sm" aria-label="More days" onClick={() => setReqs(reqs.map((x, j) => (j === i ? { ...x, days: Math.min(7, x.days + 1) } : x)))}>
                    <Plus size={14} />
                  </button>
                  <span className="flex-1 text-sm text-muted">{r.days === 1 ? "day of" : "days of"}</span>
                  <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label="Remove requirement" onClick={() => setReqs(reqs.filter((_, j) => j !== i))}>
                    <X size={16} />
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Disciplines for this requirement">
                  {countable.map((d) => {
                    const on = r.disciplines.includes(d.id);
                    return (
                      <button key={d.id} type="button" aria-pressed={on} onClick={() => setReqs(reqs.map((x, j) => (j === i ? { ...x, disciplines: on ? x.disciplines.filter((y) => y !== d.id) : [...x.disciplines, d.id] } : x)))} className={`press chip ${on ? "chip-accent" : ""}`}>
                        {d.name}
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
          {reqs.length < 3 && (
            <button type="button" className="btn btn-ghost btn-sm mt-2" onClick={() => setReqs([...reqs, { disciplines: [], days: 1 }])}>
              <Plus size={14} /> Add a requirement
            </button>
          )}
          {required > target && (
            <p className="field-error" role="alert">
              These add up to {required} days, more than your target of {target}. Raise the target or ask for fewer days.
            </p>
          )}
        </fieldset>
      </div>
    </Sheet>
  );
}

/** Max heart rate for zones. Blank uses the common 220 - age estimate, which
 * can be ten beats out either way, so a known number is better. */
function MaxHrField({ value, birthYear, onSave }: { value: number | null; birthYear: number | null; onSave: (v: number | null) => void }) {
  const [text, setText] = useState(value ? String(value) : "");
  const estimate = birthYear ? 220 - (new Date().getFullYear() - birthYear) : null;
  const n = Number(text);
  const valid = text === "" || (Number.isInteger(n) && n >= 100 && n <= 230);
  return (
    <div>
      <label className="field-label" htmlFor="max-hr">Max heart rate (bpm)</label>
      <div className="flex gap-2">
        <input id="max-hr" className="input num flex-1" inputMode="numeric" placeholder={estimate ? `About ${estimate}, estimated from age` : "e.g. 185"} value={text} onChange={(e) => setText(e.target.value.replace(/[^\d]/g, ""))} />
        <button type="button" className="btn btn-secondary" disabled={!valid || text === (value ? String(value) : "")} onClick={() => onSave(text ? n : null)}>
          Save
        </button>
      </div>
      <p className="field-hint">Used for time in heart-rate zones on imported sessions. Leave it blank to use an estimate from your age.</p>
    </div>
  );
}
