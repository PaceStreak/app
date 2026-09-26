import { useState } from "react";
import { useNavigate } from "react-router";
import { api, errorText } from "../lib/api";
import { localToday } from "../lib/dates";
import { queryClient } from "../lib/queries";
import { useMe } from "../lib/session";
import type { PlanSession } from "../lib/types";
import { useLog } from "../shell/LogContext";
import { Barbell, Clock, Feather, Moon, Pause, Thermometer, ThermometerHot } from "./phosphor";
import { Sheet } from "./Sheet";
import { toast } from "./toast";

type Choice = { id: string; icon: typeof Feather; title: string; body: string; run: () => void };

/**
 * "Not feeling 100%?" - adjust today instead of skipping it. Every option
 * still keeps the plan day and the week: a lighter version, a heat-adjusted
 * one, a short one, another routine, or rest. The advice is the
 * conservative, widely given kind; for anything more than a cold, rest.
 */
export function AdjustToday({ open, onClose, planned }: { open: boolean; onClose: () => void; planned: PlanSession | null }) {
  const me = useMe();
  const navigate = useNavigate();
  const { openLog } = useLog();
  const [unwell, setUnwell] = useState(false);
  const minutes = planned?.minutes ?? null;
  const strength = planned?.routine_id != null || planned?.discipline === "strength";

  const go = (to: string) => {
    onClose();
    navigate(to);
  };
  const log = (tags: string[], share: number, notes: string) => {
    onClose();
    openLog({ discipline: planned?.discipline ?? "run", minutes: minutes ? Math.max(10, Math.round(minutes * share)) : undefined, tags, title: planned?.title ? `${planned.title} (adjusted)`.slice(0, 80) : undefined, notes });
  };
  const lighter = (tag: string, notes: string, share = 0.6) =>
    planned?.routine_id ? go(`/workouts/live?routine=${planned.routine_id}&easy=1&tag=${tag}`) : log([tag], share, notes);
  const rest = async () => {
    try {
      await api(`/me/rest-days/${localToday(me.profile.timezone)}`, { method: "PUT", body: { kind: unwell ? "sick" : "rest" } });
      await queryClient.invalidateQueries({ queryKey: ["rest-days"] });
      toast.success("Rest day logged", { body: "Rest never costs you the streak. Feel better." });
      onClose();
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const choices: Choice[] = unwell
    ? [
        {
          id: "easy",
          icon: Feather,
          title: "Something very easy",
          body: "A cold above the neck? Twenty gentle minutes is usually fine. Stop if it makes you feel worse.",
          run: () => lighter("unwell", "Under the weather: kept it very easy.", 0.4),
        },
        { id: "rest", icon: Moon, title: "Rest today", body: "Fever, aches or a chest cold: rest. It never costs the streak.", run: () => void rest() },
        { id: "pause", icon: Pause, title: "Pause the streak", body: "Ill for a few days? A pause keeps every week safe until you're back.", run: () => go("/settings/training#pause") },
      ]
    : [
        {
          id: "lighter",
          icon: Feather,
          title: "A lighter version",
          body: strength ? "Half the sets, about 10% lighter, nothing near failure. It still completes today." : `About ${minutes ? Math.round(minutes * 0.6) : "two thirds of the"} minutes at an easy, chatty pace.`,
          run: () => lighter("lighter", "Lighter version of the plan."),
        },
        {
          id: "hot",
          icon: ThermometerHot,
          title: "It's hot",
          body: strength ? "Lighter, with longer rests and water to hand." : "Same time on your feet, slower: keep the effort easy, not the pace. Drink before and after.",
          run: () => lighter("hot", "Hot day: slowed down to keep the effort easy.", 0.85),
        },
        { id: "unwell", icon: Thermometer, title: "Under the weather", body: "Options for a cold, or worse.", run: () => setUnwell(true) },
        {
          id: "short",
          icon: Clock,
          title: "Short on time",
          body: strength ? "The first half of the routine, done properly." : `${minutes ? Math.max(10, Math.round(minutes / 2)) : "Half the"} minutes. Short sessions keep the habit.`,
          run: () => (planned?.routine_id ? go(`/workouts/live?routine=${planned.routine_id}&short=1&tag=short`) : log(["short"], 0.5, "Short on time.")),
        },
        ...(strength ? [{ id: "other", icon: Barbell, title: "Another routine", body: "Any strength session completes a strength plan day.", run: () => go("/routines") }] : []),
        { id: "rest", icon: Moon, title: "Rest instead", body: "Log a rest day on purpose. The week only needs its days.", run: () => void rest() },
      ];

  return (
    <Sheet
      open={open}
      onClose={() => {
        setUnwell(false);
        onClose();
      }}
      title={unwell ? "Under the weather" : "Adjust today"}
    >
      <ul className="-mx-2 flex flex-col">
        {choices.map((c) => (
          <li key={c.id}>
            <button type="button" className="press flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left hover:bg-surface-2" onClick={c.run}>
              <c.icon size={22} className="mt-0.5 shrink-0 text-accent-text" aria-hidden />
              <span>
                <span className="block font-semibold">{c.title}</span>
                <span className="block text-sm text-muted">{c.body}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-dim">General guidance, not medical advice. Chest pain, dizziness or a fever: stop and rest.</p>
    </Sheet>
  );
}
