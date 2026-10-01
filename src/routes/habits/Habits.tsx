import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { AddHabit } from "../../components/HabitForm";
import { HabitImport, IMPORT_HINT } from "../../components/HabitImport";
import { HabitRoutines } from "../../components/HabitRoutines";
import { HabitRow } from "../../components/HabitRow";
import { Fire, Plus, Sparkle } from "../../components/phosphor";
import { Empty, ErrorState, Loading, PageHeader, Section } from "../../components/ui";
import { api } from "../../lib/api";
import { localToday } from "../../lib/dates";
import { TIMES } from "../../lib/habits";
import { useHabitCatalog, useHabits, useStats } from "../../lib/queries";
import { useMe } from "../../lib/session";
import type { Habit } from "../../lib/types";

/**
 * Every habit, grouped by when in the day it happens, each doable from here.
 * The list starts empty on purpose: a few habits chosen well beat a screen
 * of defaults nobody picked.
 */
export default function Habits() {
  const me = useMe();
  const today = localToday(me.profile.timezone);
  const habits = useHabits();
  const stats = useStats();
  const catalog = useHabitCatalog();
  const [adding, setAdding] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const archived = useQuery({ queryKey: ["habits", "archived"], queryFn: () => api<Habit[]>("/habits?archived=true"), enabled: showArchived });

  if (habits.isError && !habits.data) return <ErrorState error={habits.error} onRetry={() => void habits.refetch()} />;
  const list = habits.data ?? [];
  const breaking = list.filter((h) => h.kind === "quit");
  const doing = list.filter((h) => h.kind !== "quit");
  const life = stats.data?.life;

  return (
    <div>
      <PageHeader
        title="Habits"
        back="/you"
        subtitle="Anything worth doing regularly. Each keeps its own weekly streak."
        action={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>
            <Plus size={16} /> Add
          </button>
        }
      />

      {life && (
        <Link to="/settings/training#life" className="press card mt-4 flex items-center gap-3 p-4">
          <Fire size={24} weight="fill" className="shrink-0 text-flame" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Whole-life streak: {life.current} {life.current === 1 ? "week" : "weeks"}</span>
            <span className="block text-sm text-dim">
              {life.this_week_days} of {life.target} days this week with any training or habit
            </span>
          </span>
        </Link>
      )}

      {!habits.data ? (
        <Loading />
      ) : list.length === 0 ? (
        <Empty
          icon={<Sparkle size={26} />}
          title="No habits yet"
          body="Reading, water, a language, meditation, calling home, or something you're giving up. Start with one or two."
        />
      ) : (
        <>
          {TIMES.map((t) => {
            const group = doing.filter((h) => h.time_of_day === t.value);
            if (!group.length) return null;
            return (
              <Section key={t.value} title={t.label}>
                <div className="card divide-y divide-line">
                  {group.map((h) => (
                    <HabitRow key={h.id} habit={h} today={today} />
                  ))}
                </div>
              </Section>
            );
          })}
          <HabitRoutines habits={list} today={today} />
          {breaking.length > 0 && (
            <Section title="Breaking">
              <div className="card divide-y divide-line">
                {breaking.map((h) => (
                  <HabitRow key={h.id} habit={h} today={today} />
                ))}
              </div>
              <p className="field-hint">Private, like every habit. A slip is logged, not punished; what counts is most days.</p>
            </Section>
          )}
        </>
      )}

      <button type="button" className="btn btn-secondary mt-6 w-full" onClick={() => setAdding(true)}>
        <Plus size={18} /> Add a habit
      </button>
      <HabitImport />
      <p className="field-hint text-center">{IMPORT_HINT}</p>
      <button type="button" className="btn btn-ghost mt-2 w-full text-dim" onClick={() => setShowArchived(!showArchived)}>
        {showArchived ? "Hide archived habits" : "Show archived habits"}
      </button>
      {showArchived && (
        <ul className="card mt-2 divide-y divide-line">
          {(archived.data ?? [])
            .filter((h) => h.archived)
            .map((h) => (
              <li key={h.id}>
                <Link to={`/habits/${h.id}`} className="press flex items-center gap-3 px-4 py-3 text-dim">
                  <span aria-hidden>{h.emoji}</span> {h.name}
                </Link>
              </li>
            ))}
          {archived.data && !archived.data.some((h) => h.archived) && <li className="px-4 py-3 text-sm text-dim">Nothing archived.</li>}
        </ul>
      )}
      {catalog.data && <AddHabit open={adding} onClose={() => setAdding(false)} />}
    </div>
  );
}
