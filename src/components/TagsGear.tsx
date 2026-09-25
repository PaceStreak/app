import { useMemo, useState, type KeyboardEvent } from "react";
import { useGear, useWorkouts } from "../lib/queries";
import { cleanTag } from "../lib/training";
import { Hash, X } from "./phosphor";

const MAX_TAGS = 8;

/** Private labels for finding sessions again. Suggests the ones you've used. */
export function TagInput({ value, onChange }: { value: string[]; onChange: (tags: string[]) => void }) {
  const workouts = useWorkouts();
  const [text, setText] = useState("");
  const recent = useMemo(() => {
    const counts = new Map<string, number>();
    for (const w of (workouts ?? []).slice(0, 200)) for (const t of w.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  }, [workouts]);
  const typed = cleanTag(text);
  const suggestions = recent.filter((t) => !value.includes(t) && (!typed || t.startsWith(typed))).slice(0, 6);

  const add = (raw: string) => {
    const tag = cleanTag(raw);
    if (tag && !value.includes(tag) && value.length < MAX_TAGS) onChange([...value, tag]);
    setText("");
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "," || e.key === " ") {
      if (text.trim()) {
        e.preventDefault();
        add(text);
      }
    } else if (e.key === "Backspace" && !text && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div>
      <label className="field-label" htmlFor="tag-input">
        Tags <span className="font-normal text-dim">(private)</span>
      </label>
      <div className="input flex h-auto min-h-12 flex-wrap items-center gap-1.5 py-2">
        {value.map((t) => (
          <span key={t} className="chip chip-accent h-7 gap-1 pr-1">
            #{t}
            <button type="button" className="rounded-full p-0.5 hover:bg-black/10" aria-label={`Remove tag ${t}`} onClick={() => onChange(value.filter((x) => x !== t))}>
              <X size={12} />
            </button>
          </span>
        ))}
        {value.length < MAX_TAGS && (
          <input
            id="tag-input"
            className="min-w-24 flex-1 bg-transparent outline-none"
            placeholder={value.length ? "" : "e.g. hills, with-sam"}
            value={text}
            maxLength={30}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKey}
            onBlur={() => text.trim() && add(text)}
            autoCapitalize="none"
            enterKeyHint="done"
          />
        )}
      </div>
      {suggestions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Tags you've used">
          {suggestions.map((t) => (
            <button key={t} type="button" className="press chip h-7" onClick={() => add(t)}>
              <Hash size={12} aria-hidden />
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Which shoes or bike this session used. Hidden until there is gear. */
export function GearPicker({ value, onChange, discipline }: { value: string | null; onChange: (id: string | null) => void; discipline: string }) {
  const gear = useGear();
  const options = (gear.data ?? []).filter((g) => !g.retired || g.id === value);
  if (!options.length) return null;
  const sorted = [...options].sort((a, b) => Number(b.default_for.includes(discipline)) - Number(a.default_for.includes(discipline)));
  return (
    <div>
      <label className="field-label" htmlFor="gear-pick">
        Gear
      </label>
      <select id="gear-pick" className="input" value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">None</option>
        {sorted.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
            {g.retired ? " (retired)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
