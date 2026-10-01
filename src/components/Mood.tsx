import { useQuery } from "@tanstack/react-query";
import { toast } from "./toast";
import { api, errorText } from "../lib/api";
import { queryClient } from "../lib/queries";
import { sendOrQueue } from "../lib/requests";
import type { JournalDay } from "../lib/types";

export const MOODS = [
  { value: 1, emoji: "😞", label: "Rough", cell: "bg-flame/80" },
  { value: 2, emoji: "😕", label: "Low", cell: "bg-flame/40" },
  { value: 3, emoji: "😐", label: "Okay", cell: "bg-surface-3" },
  { value: 4, emoji: "🙂", label: "Good", cell: "bg-accent/50" },
  { value: 5, emoji: "😄", label: "Great", cell: "bg-accent" },
];

/** Save a day's mood and note; both empty clears it. Queues when offline. */
export async function saveJournal(day: string, mood: number | null, note: string | null) {
  const result = await sendOrQueue(`/journal/${day}`, "PUT", { mood, note });
  await queryClient.invalidateQueries({ queryKey: ["journal"] });
  return result;
}

/** One tap for today's mood, for the Today screen. */
export function MoodPicker({ day, value, onPick }: { day: string; value: number | null; onPick?: (mood: number) => void }) {
  return (
    <div className="flex justify-between gap-1" role="group" aria-label="Mood">
      {MOODS.map((m) => (
        <button
          key={m.value}
          type="button"
          className={`press flex flex-1 flex-col items-center rounded-lg py-2 ${value === m.value ? "bg-accent-soft ring-1 ring-accent" : "hover:bg-surface-2"}`}
          aria-pressed={value === m.value}
          onClick={() => onPick?.(m.value)}
          data-day={day}
        >
          <span className="text-2xl" aria-hidden>
            {m.emoji}
          </span>
          <span className="text-xs text-dim">{m.label}</span>
        </button>
      ))}
    </div>
  );
}

export function useJournal(days = 366) {
  return useQuery({ queryKey: ["journal", days], queryFn: () => api<JournalDay[]>(`/journal?days=${days}`) });
}


/** Today's mood in one tap, on the Today screen, until it's been given. */
export function MoodToday({ today }: { today: string }) {
  const q = useJournal(1);
  if (!q.data || q.data.some((j) => j.date === today && j.mood != null)) return null;
  return (
    <div className="card mt-4 p-4">
      <p className="mb-2 font-semibold">How's today?</p>
      <MoodPicker
        day={today}
        value={null}
        onPick={(mood) =>
          void saveJournal(today, mood, q.data?.find((j) => j.date === today)?.note ?? null).catch((err) => toast.error(errorText(err)))
        }
      />
    </div>
  );
}
