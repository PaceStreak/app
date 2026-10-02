import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { api, errorText } from "../lib/api";
import { TIMES } from "../lib/habits";
import { queryClient, useHabitCatalog } from "../lib/queries";
import type { Habit, HabitKind, HabitTemplate, TimeOfDay } from "../lib/types";
import { MagnifyingGlass, Plus } from "./phosphor";
import { Sheet } from "./Sheet";
import { toast } from "./toast";
import { Field, Segmented } from "./ui";

const KINDS: { value: HabitKind; label: string; hint: string }[] = [
  { value: "check", label: "Done / not", hint: "A tick each day you do it." },
  { value: "duration", label: "Minutes", hint: "Counts once you reach a number of minutes." },
  { value: "count", label: "A number", hint: "Pages, glasses, reps: counts once you reach it." },
  { value: "quit", label: "Breaking", hint: "Something you're cutting out. Every day is clean unless you log a slip." },
];

export interface HabitDraft {
  name: string;
  emoji: string;
  category: string;
  kind: HabitKind;
  unit: string;
  daily_goal: string;
  weekly_target: number;
  time_of_day: TimeOfDay;
  cue: string;
  why: string;
  total_goal: string;
  remind_hour: number | null;
  /** Planned weekdays, Monday = bit 0; null = any day. */
  days_mask: number | null;
}

/** Monday-first, matching days_mask's bit order. */
const WEEKDAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const countDays = (mask: number | null) => (mask == null ? 7 : mask.toString(2).split("1").length - 1);

/** "Mon, Wed, Fri" for a schedule, or null for any day. */
export function scheduleLabel(mask: number | null | undefined): string | null {
  if (mask == null) return null;
  return WEEKDAY_NAMES.filter((_, i) => mask & (1 << i))
    .map((n) => n.slice(0, 3))
    .join(", ");
}

export function draftFrom(h?: Partial<Habit> | HabitTemplate): HabitDraft {
  const goal = h && "total_goal" in h && h.total_goal ? h.total_goal : null;
  return {
    name: h?.name ?? "",
    emoji: h?.emoji ?? "✨",
    category: h?.category ?? "other",
    kind: (h?.kind as HabitKind) ?? "check",
    unit: h?.unit ?? "",
    daily_goal: h?.daily_goal != null ? String(h.daily_goal) : "",
    weekly_target: h?.weekly_target ?? 7,
    time_of_day: (h?.time_of_day as TimeOfDay) ?? "anytime",
    cue: (h && "cue" in h && h.cue) || "",
    why: (h && "why" in h && (h as Habit).why) || "",
    // Long goals are stored in the habit's unit; minutes are shown as hours.
    total_goal: goal != null ? String(h?.kind === "duration" ? goal / 60 : goal) : "",
    remind_hour: h && "remind_hour" in h ? ((h as Habit).remind_hour ?? null) : null,
    days_mask: h && "days_mask" in h ? ((h as Habit).days_mask ?? null) : null,
  };
}

export function payloadFrom(d: HabitDraft) {
  const n = (v: string) => {
    const x = Number(v.replace(",", "."));
    return v.trim() && Number.isFinite(x) && x > 0 ? x : null;
  };
  const total = n(d.total_goal);
  return {
    name: d.name.trim(),
    emoji: d.emoji.trim() || "✨",
    category: d.kind === "quit" ? "break" : d.category,
    unit: d.kind === "count" ? d.unit.trim() || null : d.kind === "duration" ? "minutes" : null,
    daily_goal: d.kind === "count" || d.kind === "duration" ? (n(d.daily_goal) ?? 1) : null,
    weekly_target: d.weekly_target,
    time_of_day: d.time_of_day,
    cue: d.cue.trim() || null,
    why: d.why.trim() || null,
    total_goal: d.kind === "count" || d.kind === "duration" ? (total != null ? (d.kind === "duration" ? total * 60 : total) : null) : null,
    remind_hour: d.kind === "quit" ? null : d.remind_hour,
    days_mask: d.kind === "quit" ? null : d.days_mask,
  };
}

/** The fields of a habit, shared by "custom" and "edit". The kind is fixed
 * once a habit exists, so editing hides it. */
export function HabitFields({ draft, onChange, categories, editing }: { draft: HabitDraft; onChange: (d: HabitDraft) => void; categories: Record<string, string>; editing?: boolean }) {
  const set = (patch: Partial<HabitDraft>) => onChange({ ...draft, ...patch });
  const measured = draft.kind === "count" || draft.kind === "duration";
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-[72px_1fr] gap-3">
        <Field label="Icon" value={draft.emoji} maxLength={8} onChange={(e) => set({ emoji: e.target.value })} />
        <Field label="Name" value={draft.name} maxLength={60} placeholder="Practise guitar" onChange={(e) => set({ name: e.target.value })} />
      </div>
      {!editing && (
        <fieldset>
          <legend className="field-label">What counts</legend>
          <Segmented label="What counts" value={draft.kind} onChange={(kind) => set({ kind })} options={KINDS.map((k) => ({ value: k.value, label: k.label }))} />
          <p className="field-hint">{KINDS.find((k) => k.value === draft.kind)?.hint}</p>
        </fieldset>
      )}
      {measured && (
        <div className="grid grid-cols-2 gap-3">
          <Field label={draft.kind === "duration" ? "Minutes a day" : "A day's goal"} inputMode="decimal" value={draft.daily_goal} onChange={(e) => set({ daily_goal: e.target.value })} />
          {draft.kind === "count" ? <Field label="Unit" value={draft.unit} maxLength={20} placeholder="pages" onChange={(e) => set({ unit: e.target.value })} /> : <span />}
        </div>
      )}
      <fieldset>
        <legend className="field-label">{draft.kind === "quit" ? "Clean days a week to keep the week" : "Days a week"}</legend>
        <div className="grid grid-cols-7 gap-1.5">
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={draft.weekly_target === n}
              disabled={n > countDays(draft.days_mask)}
              className={`chip num h-10 justify-center px-0 ${draft.weekly_target === n ? "chip-accent" : ""}`}
              onClick={() => set({ weekly_target: n })}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="field-hint">Start smaller than you think. You can raise it once it's easy.</p>
      </fieldset>
      {draft.kind !== "quit" && (
        <fieldset>
          <legend className="field-label">Which days</legend>
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAY_LETTERS.map((letter, i) => {
              const on = draft.days_mask == null || (draft.days_mask & (1 << i)) !== 0;
              return (
                <button
                  key={i}
                  type="button"
                  aria-pressed={draft.days_mask != null && on}
                  aria-label={WEEKDAY_NAMES[i]}
                  className={`chip h-10 justify-center px-0 ${draft.days_mask != null && on ? "chip-accent" : ""}`}
                  onClick={() => {
                    const current = draft.days_mask ?? 0;
                    const next = current ^ (1 << i);
                    // All days off means "any day", not "never".
                    const mask = next === 0 ? null : next;
                    // A target that matched the old day count follows the new
                    // one; a deliberately smaller target is only capped.
                    const following = draft.weekly_target === countDays(draft.days_mask);
                    set({ days_mask: mask, weekly_target: following ? countDays(mask) : Math.min(draft.weekly_target, countDays(mask)) });
                  }}
                >
                  {letter}
                </button>
              );
            })}
          </div>
          <p className="field-hint">
            {draft.days_mask == null
              ? "Any day. Pick days to plan it for those only: reminders and Today follow them, and a day done off-plan still counts."
              : `Planned for ${scheduleLabel(draft.days_mask)}. Reminders and Today follow these days; a day done off-plan still counts.`}
          </p>
        </fieldset>
      )}
      {draft.kind !== "quit" && (
        <>
          <fieldset>
            <legend className="field-label">When</legend>
            <Segmented label="When" value={draft.time_of_day} onChange={(time_of_day) => set({ time_of_day })} options={TIMES} />
          </fieldset>
          <Field label="After I… (optional)" value={draft.cue} maxLength={120} placeholder="After I pour my morning coffee" hint="Tying a habit to something you already do is one of the best-evidenced ways to make it stick." onChange={(e) => set({ cue: e.target.value })} />
          <div>
            <label className="field-label" htmlFor="remind">Reminder (optional)</label>
            <select id="remind" className="input" value={draft.remind_hour ?? ""} onChange={(e) => set({ remind_hour: e.target.value === "" ? null : Number(e.target.value) })}>
              <option value="">No reminder</option>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {new Date(2000, 0, 1, h).toLocaleTimeString(undefined, { hour: "numeric" })}
                </option>
              ))}
            </select>
            <p className="field-hint">Only if it isn't done yet that day, and never in your quiet hours.</p>
          </div>
        </>
      )}
      {measured && (
        <Field
          label={draft.kind === "duration" ? "Long goal, in hours (optional)" : `Long goal, in ${draft.unit || "units"} (optional)`}
          inputMode="decimal"
          value={draft.total_goal}
          placeholder={draft.kind === "duration" ? "100" : ""}
          hint="For a skill: see the total climb and when you'll get there at your current pace."
          onChange={(e) => set({ total_goal: e.target.value })}
        />
      )}
      <Field label="Why it matters (optional)" value={draft.why} maxLength={200} placeholder="So I can play with my kids" hint="Shown on the habit's page, for the days it's hard." onChange={(e) => set({ why: e.target.value })} />
      {draft.kind !== "quit" && (
        <div>
          <label className="field-label" htmlFor="cat">Area of life</label>
          <select id="cat" className="input" value={draft.category} onChange={(e) => set({ category: e.target.value })}>
            {Object.entries(categories)
              .filter(([id]) => id !== "break")
              .map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
          </select>
        </div>
      )}
    </div>
  );
}

/**
 * Add a habit: browse ready-made ones by area of life, search, or make your
 * own. Picking a template adds it straight away; every field can be changed
 * afterwards on the habit's page.
 */
export function AddHabit({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const catalog = useHabitCatalog();
  const [cat, setCat] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [custom, setCustom] = useState<HabitDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const categories = catalog.data?.categories ?? {};

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (catalog.data?.templates ?? []).filter((t) => (!cat || t.category === cat) && (!term || `${t.name} ${t.blurb} ${categories[t.category] ?? ""}`.toLowerCase().includes(term)));
  }, [catalog.data, cat, q, categories]);

  const create = async (body: object) => {
    setBusy(true);
    try {
      const habit = await api<Habit>("/habits", { body });
      await Promise.all(["habits", "stats"].map((k) => queryClient.invalidateQueries({ queryKey: [k] })));
      toast.success(`${habit.emoji} ${habit.name} added`);
      setCustom(null);
      onClose();
      navigate(`/habits/${habit.id}`);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Sheet open={open && !custom} onClose={onClose} title="Add a habit" size="full">
        <div className="sticky top-0 z-10 -mx-5 bg-surface px-5 pb-3">
          <div className="relative">
            <MagnifyingGlass size={18} className="absolute top-1/2 left-4 -translate-y-1/2 text-dim" aria-hidden />
            <input className="input pl-11" placeholder="Search: read, water, guitar, meditate…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search habits" />
          </div>
          <div className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1">
            <button type="button" className={`chip h-8 ${cat === null ? "chip-accent" : ""}`} onClick={() => setCat(null)}>
              All
            </button>
            {Object.entries(categories).filter(([id]) => id !== "other").map(([id, name]) => (
              <button key={id} type="button" className={`chip h-8 whitespace-nowrap ${cat === id ? "chip-accent" : ""}`} onClick={() => setCat(cat === id ? null : id)}>
                {name}
              </button>
            ))}
          </div>
        </div>
        <button type="button" className="btn btn-secondary mb-3 w-full" onClick={() => setCustom({ ...draftFrom(), name: q.trim() })}>
          <Plus size={18} /> Make your own{q.trim() ? `: "${q.trim()}"` : ""}
        </button>
        <ul className="divide-y divide-line">
          {shown.map((t) => (
            <li key={t.id}>
              <button type="button" disabled={busy} className="press flex w-full items-start gap-3 py-3 text-left" onClick={() => void create({ template_id: t.id })}>
                <span className="grid size-10 shrink-0 place-items-center rounded-md bg-surface-2 text-xl" aria-hidden>
                  {t.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{t.name}</span>
                  <span className="block text-sm text-dim">{t.blurb}</span>
                  <span className="mt-0.5 block text-xs text-dim">
                    {categories[t.category]} · {t.kind === "quit" ? `${t.weekly_target} clean days a week` : `${t.weekly_target === 7 ? "daily" : `${t.weekly_target} days a week`}`}
                    {t.daily_goal ? ` · ${t.daily_goal} ${t.kind === "duration" ? "min" : (t.unit ?? "")}` : ""}
                  </span>
                </span>
                <Plus size={18} className="mt-1 shrink-0 text-dim" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        {shown.length === 0 && <p className="py-8 text-center text-muted">Nothing like that yet. Make your own above.</p>}
      </Sheet>
      <Sheet
        open={custom !== null}
        onClose={() => setCustom(null)}
        title="Your own habit"
        size="lg"
        footer={
          <button type="button" className="btn btn-primary w-full" disabled={busy || !custom?.name.trim()} onClick={() => custom && void create(payloadFrom(custom))}>
            Add habit
          </button>
        }
      >
        {custom && <HabitFields draft={custom} onChange={setCustom} categories={categories} />}
      </Sheet>
    </>
  );
}
