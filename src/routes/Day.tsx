import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router";
import { MOODS } from "../components/Mood";
import { CaretLeft, CaretRight, Lock } from "../components/phosphor";
import { ErrorState, Loading, PageHeader, Section } from "../components/ui";
import { api } from "../lib/api";
import { addDays, fmtMonthDay, localToday } from "../lib/dates";
import { useLibrary } from "../lib/queries";
import { useMe } from "../lib/session";
import type { DayView } from "../lib/types";
import { distance, duration, fromKg } from "../lib/units";

const MEAL_LABEL: Record<string, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snacks" };
const SCORE = ["", "very low", "low", "okay", "good", "great"];

/** One date, everything on it: sessions, habits, food, mood and body. */
export default function Day() {
  const { date = "" } = useParams();
  const me = useMe();
  const navigate = useNavigate();
  const lib = useLibrary();
  const today = localToday(me.profile.timezone);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const q = useQuery({ queryKey: ["day", date], queryFn: () => api<DayView>(`/day/${date}`), enabled: valid });
  const go = (d: string) => navigate(`/day/${d}`, { replace: true });

  if (!valid) return <ErrorState error={new Error("That isn't a date")} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const d = q.data;
  const mood = MOODS.find((m) => m.value === d?.journal?.mood);
  const nothing = d && !d.workouts.length && !d.habits.some((h) => h.amount > 0) && !d.food.kcal && !d.journal && !d.readiness && !d.rest && !d.weigh_ins.length;

  return (
    <div>
      <PageHeader
        title={date === today ? "Today" : date === addDays(today, -1) ? "Yesterday" : fmtMonthDay(date)}
        back
        subtitle={
          <span className="inline-flex items-center gap-1.5">
            <Lock size={14} aria-hidden /> Only you see this
          </span>
        }
        action={
          <span className="flex">
            <button type="button" className="btn btn-ghost btn-icon" aria-label="Previous day" onClick={() => go(addDays(date, -1))}>
              <CaretLeft size={20} />
            </button>
            <button type="button" className="btn btn-ghost btn-icon" aria-label="Next day" disabled={date >= today} onClick={() => go(addDays(date, 1))}>
              <CaretRight size={20} />
            </button>
          </span>
        }
      />
      {!d ? (
        <Loading />
      ) : nothing ? (
        <p className="card p-4 text-muted">Nothing was logged on this day.</p>
      ) : (
        <>
          {(d.journal || d.readiness || d.rest) && (
            <div className="card space-y-2 p-4">
              {mood && (
                <p className="text-lg">
                  <span aria-hidden>{mood.emoji}</span> {mood.label}
                </p>
              )}
              {d.journal?.note && <p className="whitespace-pre-line">{d.journal.note}</p>}
              {d.readiness && (
                <p className="text-sm text-dim">
                  Sleep {SCORE[d.readiness.sleep]}, energy {SCORE[d.readiness.energy]}, soreness {SCORE[d.readiness.soreness]}
                </p>
              )}
              {d.rest && <p className="text-sm text-dim">Rest day ({d.rest.kind}){d.rest.note ? `: ${d.rest.note}` : ""}</p>}
            </div>
          )}

          {d.workouts.length > 0 && (
            <Section title="Training">
              <ul className="card divide-y divide-line">
                {d.workouts.map((w) => (
                  <li key={w.id}>
                    <Link to={`/workouts/${w.id}`} className="press flex items-center justify-between gap-3 px-4 py-3">
                      <span className="truncate">{w.title || lib?.discipline(w.discipline)?.name || w.discipline}</span>
                      <span className="shrink-0 text-sm text-dim">
                        {[duration(w.duration_sec), distance(w.distance_m, me.profile.distance_unit)].filter(Boolean).join(" · ")}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {d.habits.length > 0 && (
            <Section title={`Habits · ${d.habits.filter((h) => h.done && h.kind !== "quit").length} of ${d.habits.filter((h) => h.kind !== "quit").length}`}>
              <ul className="card divide-y divide-line">
                {d.habits.map((h) => (
                  <li key={h.id}>
                    <Link to={`/habits/${h.id}`} className="press flex items-center gap-3 px-4 py-3">
                      <span aria-hidden>{h.emoji}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{h.name}</span>
                        {h.note && <span className="block truncate text-sm text-dim">{h.note}</span>}
                      </span>
                      <span className={`shrink-0 text-sm ${h.done ? "text-accent-text" : "text-dim"}`}>
                        {h.kind === "quit" ? (h.amount > 0 ? `${h.amount} slip${h.amount === 1 ? "" : "s"}` : "Clean") : h.done ? "Done" : h.amount > 0 ? `${h.amount} ${h.unit ?? ""}` : "Not done"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {d.food.kcal > 0 && (
            <Section title={`Food · ${Math.round(d.food.kcal)} kcal, ${Math.round(d.food.protein_g)} g protein`}>
              <ul className="card divide-y divide-line">
                {d.food.meals.map((m) => (
                  <li key={m.meal} className="flex justify-between px-4 py-3">
                    <span>{MEAL_LABEL[m.meal] ?? m.meal}</span>
                    <span className="num text-dim">{Math.round(m.kcal)} kcal</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {d.weigh_ins.length > 0 && (
            <Section title="Weigh-ins">
              <p className="card p-4 num">
                {d.weigh_ins.map((w) => `${fromKg(w.weight_kg, me.profile.weight_unit).toFixed(1)} ${me.profile.weight_unit}`).join(" · ")}
              </p>
            </Section>
          )}
        </>
      )}
    </div>
  );
}
