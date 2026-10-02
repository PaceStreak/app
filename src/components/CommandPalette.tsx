import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { MagnifyingGlass } from "./phosphor";
import { Sheet } from "./Sheet";
import { toast } from "./toast";
import { errorText } from "../lib/api";
import { localToday } from "../lib/dates";
import { isDone, setHabitDay } from "../lib/habits";
import { useHabits } from "../lib/queries";
import { useMe } from "../lib/session";
import { SEARCH_KIND, useSearch } from "../routes/Search";
import { useLog } from "../shell/LogContext";

interface Command {
  id: string;
  group: "Go to" | "Do" | "Tick a habit" | "Found";
  label: string;
  hint?: string;
  keywords?: string;
  run: () => void | Promise<void>;
}

/** Screens reachable by `g` then a letter, and from the palette. */
export const GO_KEYS: { key: string; to: string; label: string }[] = [
  { key: "t", to: "/", label: "Today" },
  { key: "h", to: "/habits", label: "Habits" },
  { key: "f", to: "/food", label: "Food" },
  { key: "j", to: "/journal", label: "Journal" },
  { key: "i", to: "/insights", label: "Insights" },
  { key: "p", to: "/progress", label: "Progress" },
  { key: "y", to: "/history", label: "History" },
  { key: "b", to: "/body", label: "Body" },
  { key: "n", to: "/notifications", label: "Notifications" },
  { key: "s", to: "/settings", label: "Settings" },
];

const typing = (e: KeyboardEvent) => {
  const el = e.target as HTMLElement | null;
  return !!el && (/input|textarea|select/i.test(el.tagName) || el.isContentEditable);
};

/** Words in the query must each start a word in the label or keywords:
 * "jo" finds Journal, "tick wa" finds "Tick Water". */
export function matches(cmd: Pick<Command, "label" | "keywords">, q: string): boolean {
  const hay = `${cmd.label} ${cmd.keywords ?? ""}`.toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => hay.split(/[^a-z0-9]+/).some((part) => part.startsWith(w)) || hay.includes(w));
}

/**
 * ⌘K / Ctrl+K (or "/") opens a palette over the app: jump to any screen,
 * log, tick today's habits, or search everything logged. Also owns the
 * other global shortcuts: `g` then a letter navigates, `?` lists them all.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const navigate = useNavigate();
  const { openLog } = useLog();

  useEffect(() => {
    let pendingG = 0;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e) || document.querySelector("dialog[open]")) return;
      if (e.key === "/") {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "?") {
        e.preventDefault();
        setHelp(true);
      } else if (e.key === "g") {
        pendingG = Date.now();
      } else if (Date.now() - pendingG >= 1200 && e.key === "n") {
        e.preventDefault();
        openLog();
      } else if (Date.now() - pendingG < 1200) {
        const target = GO_KEYS.find((g) => g.key === e.key);
        pendingG = 0;
        if (target) {
          e.preventDefault();
          navigate(target.to);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    const openPalette = () => setOpen(true);
    window.addEventListener("ps:palette", openPalette);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("ps:palette", openPalette);
    };
  }, [navigate, openLog]);

  return (
    <>
      {open && <Palette onClose={() => setOpen(false)} onHelp={() => { setOpen(false); setHelp(true); }} />}
      <Sheet open={help} onClose={() => setHelp(false)} title="Keyboard shortcuts">
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-2.5">
          {[
            ["⌘ K", "Command palette (Ctrl K on Windows and Linux)"],
            ["/", "Search"],
            ["N", "Log a session"],
            ["?", "This list"],
            ...GO_KEYS.map((g) => [`G ${g.key.toUpperCase()}`, g.label]),
          ].map(([k, v]) => (
            <div key={k} className="contents">
              <dt>
                <kbd className="kbd">{k}</kbd>
              </dt>
              <dd className="text-muted">{v}</dd>
            </div>
          ))}
        </dl>
      </Sheet>
    </>
  );
}

function Palette({ onClose, onHelp }: { onClose: () => void; onHelp: () => void }) {
  const me = useMe();
  const navigate = useNavigate();
  const { openLog } = useLog();
  const habits = useHabits().data ?? [];
  const today = localToday(me.profile.timezone);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const search = useSearch(q);

  const commands = useMemo<Command[]>(() => {
    const go = (to: string) => () => navigate(to);
    const base: Command[] = [
      { id: "log", group: "Do", label: "Log a session", hint: "N", keywords: "workout train add", run: () => openLog() },
      { id: "meal", group: "Do", label: "Log food", keywords: "meal calories eat", run: go("/food") },
      { id: "mood", group: "Do", label: "Write in the journal", keywords: "mood note diary", run: go("/journal") },
      { id: "day", group: "Do", label: "See everything today", keywords: "day summary", run: go(`/day/${today}`) },
      { id: "trash", group: "Do", label: "Open the trash", keywords: "deleted restore undo", run: go("/trash") },
      { id: "help", group: "Do", label: "Keyboard shortcuts", hint: "?", keywords: "keys help", run: onHelp },
      ...GO_KEYS.map((g) => ({ id: `go:${g.to}`, group: "Go to" as const, label: g.label, hint: `G ${g.key.toUpperCase()}`, run: go(g.to) })),
      { id: "go:search", group: "Go to", label: "Search", hint: "/", run: go("/search") },
      { id: "go:records", group: "Go to", label: "Personal records", run: go("/records") },
      { id: "go:routines", group: "Go to", label: "Routines", run: go("/routines") },
      { id: "go:plans", group: "Go to", label: "Training plans", run: go("/plans") },
      { id: "go:tools", group: "Go to", label: "Tools", keywords: "timer plates", run: go("/tools") },
    ];
    const ticks: Command[] = habits
      .filter((h) => h.kind !== "quit" && !h.archived)
      .map((h) => ({
        id: `tick:${h.id}`,
        group: "Tick a habit" as const,
        label: `${h.emoji} ${h.name}`,
        hint: h.today.done ? "Done" : undefined,
        keywords: "tick done habit",
        run: async () => {
          if (h.today.done) {
            navigate(`/habits/${h.id}`);
            return;
          }
          const goal = h.kind === "check" ? 1 : (h.daily_goal ?? 1);
          try {
            await setHabitDay(h, today, Math.max(goal, h.today.amount), today);
            if (isDone(h, goal)) toast.success(`${h.name}: done`);
          } catch (err) {
            toast.error(errorText(err));
          }
        },
      }));
    return [...base, ...ticks];
  }, [habits, navigate, openLog, onHelp, today]);

  const found: Command[] = (search.data?.results ?? []).map((r) => ({
    id: `found:${r.kind}:${r.id}`,
    group: "Found",
    label: r.title,
    hint: SEARCH_KIND[r.kind],
    run: () => navigate(r.url),
  }));
  // Without a query, the habits still open today; with one, everything that matches.
  const shown = q.trim() ? [...commands.filter((c) => matches(c, q.trim())), ...found] : commands.filter((c) => c.group !== "Tick a habit" || c.hint !== "Done");
  const clamped = Math.min(active, Math.max(0, shown.length - 1));

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${clamped}"]`)?.scrollIntoView({ block: "nearest" });
  }, [clamped]);

  const run = (cmd: Command | undefined) => {
    if (!cmd) return;
    onClose();
    void cmd.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((clamped + 1) % Math.max(1, shown.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((clamped - 1 + shown.length) % Math.max(1, shown.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      run(shown[clamped]);
    }
  };

  let lastGroup = "";
  return (
    <Sheet open onClose={onClose} title="Go anywhere">
      <div className="relative">
        <MagnifyingGlass size={18} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-dim" aria-hidden />
        <input
          className="input pl-10"
          autoFocus
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={shown[clamped] ? `${listId}-${clamped}` : undefined}
          aria-label="Type a command or search"
          placeholder="Type a command, a habit, or search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
        />
      </div>
      <ul ref={listRef} id={listId} role="listbox" aria-label="Commands" className="mt-3 max-h-[55vh] overflow-y-auto">
        {shown.map((cmd, i) => {
          const heading = cmd.group !== lastGroup ? cmd.group : null;
          lastGroup = cmd.group;
          return (
            <li key={cmd.id} role="presentation">
              {heading && <p className="nav-label mt-2 px-3">{heading}</p>}
              <div
                id={`${listId}-${i}`}
                data-index={i}
                role="option"
                aria-selected={i === clamped}
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 ${i === clamped ? "bg-surface-2" : ""}`}
                onMouseMove={() => setActive(i)}
                onClick={() => run(cmd)}
              >
                <span className="truncate">{cmd.label}</span>
                {cmd.hint && <span className="shrink-0 text-xs text-dim">{cmd.hint}</span>}
              </div>
            </li>
          );
        })}
        {shown.length === 0 && <li className="px-3 py-6 text-center text-sm text-dim">{q.trim().length >= 2 && search.isFetching ? "Searching…" : "Nothing matches."}</li>}
      </ul>
    </Sheet>
  );
}
