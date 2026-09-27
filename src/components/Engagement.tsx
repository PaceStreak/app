import { useState } from "react";
import { api, errorText } from "../lib/api";
import { fmtMonthDay } from "../lib/dates";
import { prefs } from "../lib/prefs";
import { queryClient } from "../lib/queries";
import type { QuestWeek, WagerState } from "../lib/types";
import { TickBox } from "./Marker";
import { Handshake, X } from "./phosphor";
import { toast } from "./toast";

/**
 * This week's three quests. Habits only - an early session, a balanced week,
 * rating effort - never more volume or load. Completing one is just the log
 * saying so; nothing needs claiming.
 */
export function QuestsCard({ quests }: { quests: QuestWeek }) {
  if (quests.paused || !quests.items.length) return null;
  const done = quests.items.filter((q) => q.done).length;
  return (
    <section className="card mt-6 p-4 sm:p-5" aria-labelledby="quests-title">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 id="quests-title" className="font-semibold tracking-tight">This week's quests</h2>
        <span className="num text-sm text-dim">
          {done}/{quests.items.length} · {quests.xp_each} XP each
        </span>
      </div>
      <ul className="space-y-3">
        {quests.items.map((q) => (
          <li key={q.id} className="flex items-start gap-3">
            {q.done ? (
              <span className="mt-0.5"><TickBox done size={22} label="Done" /></span>
            ) : (
              <span className="mt-0.5"><TickBox done={false} size={22} label="Not yet" /></span>
            )}
            <div className="min-w-0 flex-1">
              <p className={`font-medium ${q.done ? "text-muted" : ""}`}>{q.title}</p>
              <p className="text-sm text-dim">{q.description}</p>
              {!q.done && q.goal > 1 && (
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-none bg-surface-2">
                    <div className="h-full rounded-none bg-accent" style={{ width: `${(q.progress / q.goal) * 100}%` }} />
                  </div>
                  <span className="num text-xs text-dim">
                    {q.progress}/{q.goal}
                  </span>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The streak wager, opt-in. Offered quietly, dismissible for the week, and
 * shown with its whole deal up front: keep it and earn a freeze, miss it and
 * nothing at all happens. Never a nag and never a cost.
 */
export function WagerCard({ wager }: { wager: WagerState }) {
  const [busy, setBusy] = useState(false);
  const [, bump] = useState(0);
  const live = wager.current ?? wager.next;
  const offer = wager.options.find((o) => !o.blocked);
  const dismissKey = `wager:${offer?.week_start}`;

  const make = async (week: "this" | "next") => {
    setBusy(true);
    try {
      await api("/me/wager", { method: "POST", body: { week } });
      await queryClient.invalidateQueries({ queryKey: ["stats"] });
      toast.success("Wager made. Good luck, and rest if you need to.");
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  const cancel = async (weekStart: string) => {
    try {
      await api(`/me/wager/${weekStart}`, { method: "DELETE" });
      await queryClient.invalidateQueries({ queryKey: ["stats"] });
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  if (live) {
    const thisWeek = live === wager.current;
    return (
      <section className="card mt-3 flex items-start gap-3 p-4" aria-label="Streak wager">
        <Handshake size={22} className="mt-0.5 shrink-0 text-accent-text" aria-hidden />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold">
            {live.status === "won" ? "Wager kept" : thisWeek ? `Wager: ${live.days} days this week` : `Wager: ${live.days} days next week`}
          </p>
          <p className="text-muted">
            {live.status === "won"
              ? "A freeze is yours once the week closes."
              : thisWeek
                ? `${live.done ?? 0} of ${live.days} so far. Kept, it earns a freeze. Missed, nothing happens.`
                : `Starts ${fmtMonthDay(live.week_start)}. You can take it back until your first session that week.`}
          </p>
        </div>
        {live.status === "open" && (!thisWeek || !live.done) && (
          <button type="button" className="btn btn-ghost btn-sm text-dim" onClick={() => void cancel(live.week_start)}>
            Take back
          </button>
        )}
      </section>
    );
  }

  if (!offer || prefs.dismissed(dismissKey)) return null;
  return (
    <section className="card mt-3 flex items-start gap-3 p-4" aria-label="Streak wager">
      <Handshake size={22} className="mt-0.5 shrink-0 text-dim" aria-hidden />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">Fancy a wager?</p>
        <p className="text-muted">
          Promise {offer.days} days {offer.week === "this" ? "this week" : "next week"}, one more than your target. Keep it and earn a streak freeze{wager.freezes_available >= 2 ? " (you're at the limit of two, so this one is for the satisfaction)" : ""}. Miss it and nothing happens. One a month.
        </p>
        <button type="button" className="btn btn-secondary btn-sm mt-3" disabled={busy} onClick={() => void make(offer.week)}>
          Make the wager
        </button>
      </div>
      <button
        type="button"
        aria-label="Not now"
        className="btn btn-ghost btn-icon btn-sm text-dim"
        onClick={() => {
          prefs.dismiss(dismissKey);
          bump((n) => n + 1);
        }}
      >
        <X size={16} />
      </button>
    </section>
  );
}
