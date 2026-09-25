import { Link } from "react-router";
import { relativeDay, timeOfDay } from "../lib/dates";
import type { LibraryIndex } from "../lib/queries";
import { exerciseOrder, workedSets } from "../lib/training";
import type { Profile, Workout } from "../lib/types";
import { distance, duration, pace, plural } from "../lib/units";
import { DisciplineIcon } from "./icons";
import { CloudArrowUp, WarningCircle } from "./phosphor";

export function workoutTitle(w: Workout, lib: LibraryIndex | null) {
  if (w.title) return w.title;
  return lib?.discipline(w.discipline)?.name ?? w.discipline;
}

export function workoutSummary(w: Workout, lib: LibraryIndex | null, profile: Pick<Profile, "distance_unit">) {
  const bits: string[] = [];
  const sets = workedSets(w);
  if (sets.length) {
    const names = exerciseOrder(w)
      .slice(0, 3)
      .map((id) => lib?.byId.get(id)?.name ?? "Exercise");
    bits.push(plural(sets.length, "set"), names.join(", "));
  }
  if (w.distance_m) bits.push(distance(w.distance_m, profile.distance_unit));
  if (w.duration_sec) bits.push(duration(w.duration_sec));
  if (w.discipline === "run" && w.distance_m && w.duration_sec) bits.push(pace(w.duration_sec, w.distance_m, profile.distance_unit));
  return bits.join(" · ");
}

export function WorkoutRow({
  w,
  lib,
  profile,
  today,
}: {
  w: Workout;
  lib: LibraryIndex | null;
  profile: Pick<Profile, "distance_unit">;
  today: string;
}) {
  return (
    <Link to={`/workouts/${w.id}`} className="press flex items-center gap-3.5 px-4 py-3.5 hover:bg-surface-2/60">
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-surface-2 text-ink">
        <DisciplineIcon id={w.discipline} size={22} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-semibold">{workoutTitle(w, lib)}</span>
          {w._error ? (
            <WarningCircle size={16} className="shrink-0 text-danger" aria-label="Not saved" />
          ) : w._pending ? (
            <CloudArrowUp size={16} className="shrink-0 text-dim" aria-label="Waiting to sync" />
          ) : null}
        </span>
        <span className="num block truncate text-sm text-dim">{workoutSummary(w, lib, profile) || "Logged"}</span>
      </span>
      <span className="shrink-0 text-right text-sm text-dim">
        <span className="block">{relativeDay(w.local_date, today)}</span>
        <span className="block text-xs">{timeOfDay(w.started_at)}</span>
      </span>
    </Link>
  );
}
