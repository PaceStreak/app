import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../lib/api";
import { prefs } from "../lib/prefs";
import { queryClient } from "../lib/queries";
import { sendOrQueue } from "../lib/requests";
import type { ReadinessEntry } from "../lib/types";
import { X } from "./phosphor";

const QUESTIONS = [
  { key: "sleep", label: "Sleep", low: "Rough", high: "Great" },
  { key: "energy", label: "Energy", low: "Flat", high: "Buzzing" },
  { key: "soreness", label: "Soreness", low: "None", high: "Very sore" },
] as const;

/** 1 (low) to 5 (good), with soreness turned the right way round. */
export function readinessScore(r: Pick<ReadinessEntry, "sleep" | "energy" | "soreness">): number {
  return Math.round(((r.sleep + r.energy + (6 - r.soreness)) / 3) * 10) / 10;
}

/**
 * A ten-second morning check-in. It only changes what Today suggests - a low
 * score offers an easier day - and never scores, ranks or gates anything.
 * Wearables aren't an option here, so it's three taps instead.
 */
export function ReadinessCard({ today, onAdjust }: { today: string; onAdjust: () => void }) {
  const q = useQuery({ queryKey: ["readiness"], queryFn: () => api<ReadinessEntry[]>("/readiness?days=14") });
  const [answers, setAnswers] = useState<Partial<Record<(typeof QUESTIONS)[number]["key"], number>>>({});
  const [, bump] = useState(0);
  const dismissKey = `readiness:${today}`;
  const todays = q.data?.find((r) => r.date === today);
  if (!q.data || prefs.dismissed(dismissKey)) return null;

  if (todays) {
    const score = readinessScore(todays);
    const low = score <= 2.4;
    return (
      <section className="card mt-3 flex items-start gap-3 p-4 text-sm" aria-label="How you're feeling today">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{low ? "Running low today" : score >= 4 ? "Feeling good today" : "A normal day"}</p>
          <p className="text-muted">
            {low ? "An easier session, or rest, is a fine call. The week only needs its days." : "Train as planned, and listen to how the warm-up feels."}
          </p>
          {low && (
            <button type="button" className="btn btn-secondary btn-sm mt-3" onClick={onAdjust}>
              Adjust today
            </button>
          )}
        </div>
        <button type="button" aria-label="Hide" className="btn btn-ghost btn-icon btn-sm text-dim" onClick={() => { prefs.dismiss(dismissKey); bump((n) => n + 1); }}>
          <X size={16} />
        </button>
      </section>
    );
  }

  const done = QUESTIONS.every((qq) => answers[qq.key] != null);
  const save = async () => {
    await sendOrQueue(`/readiness/${today}`, "PUT", answers);
    queryClient.setQueryData<ReadinessEntry[]>(["readiness"], (old) => [...(old ?? []), { date: today, ...(answers as Omit<ReadinessEntry, "date">) }]);
  };

  return (
    <section className="card mt-3 p-4" aria-label="Morning check-in">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">How are you today?</p>
          <p className="text-sm text-dim">Three taps. Only you see it.</p>
        </div>
        <button type="button" aria-label="Not today" className="btn btn-ghost btn-icon btn-sm text-dim" onClick={() => { prefs.dismiss(dismissKey); bump((n) => n + 1); }}>
          <X size={16} />
        </button>
      </div>
      <div className="space-y-3">
        {QUESTIONS.map((qq) => (
          <fieldset key={qq.key}>
            <legend className="mb-1 flex w-full justify-between text-sm">
              <span className="font-medium">{qq.label}</span>
              <span className="text-xs text-dim">
                {qq.low} to {qq.high}
              </span>
            </legend>
            <div className="grid grid-cols-5 gap-1.5">
              {[1, 2, 3, 4, 5].map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={answers[qq.key] === v}
                  aria-label={`${qq.label} ${v} of 5`}
                  className={`chip num h-9 justify-center ${answers[qq.key] === v ? "chip-accent" : ""}`}
                  onClick={() => setAnswers((a) => ({ ...a, [qq.key]: v }))}
                >
                  {v}
                </button>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      <button type="button" className="btn btn-secondary mt-4 w-full" disabled={!done} onClick={() => void save()}>
        Save
      </button>
    </section>
  );
}
