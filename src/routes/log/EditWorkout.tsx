import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { getWorkout } from "../../lib/db";
import type { Workout } from "../../lib/types";
import LiveWorkout from "./LiveWorkout";
import { QuickEdit } from "./QuickEdit";

export default function EditWorkout() {
  const { id = "" } = useParams();
  const [workout, setWorkout] = useState<Workout | null | undefined>(undefined);
  useEffect(() => {
    void getWorkout(id).then((w) => setWorkout(w ?? null));
  }, [id]);
  if (workout === undefined) return <div className="skeleton mt-6 h-48" />;
  if (workout === null) return <p className="pt-10 text-center text-muted">That session isn't on this device.</p>;
  return workout.discipline === "strength" && workout.sets.length > 0 ? <LiveWorkout editId={id} /> : <QuickEdit workout={workout} />;
}
