import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { api } from "../lib/api";
import { prefs } from "../lib/prefs";
import { currentPushSubscription, isStandalone } from "../lib/pwa";
import { useMe } from "../lib/session";
import { CheckCircle, Circle, X } from "./phosphor";

/**
 * The first-run checklist. Every tick is read from real state - a session in
 * the log, a push subscription, a passkey - never from "the person tapped
 * it", so it can't claim something is set up when it isn't. It disappears
 * once everything is done, or when dismissed.
 */
export function GettingStarted({ sessions, onLog, firstFortnight }: { sessions: number; onLog: () => void; firstFortnight?: { days: number; open: boolean } }) {
  const me = useMe();
  const [dismissed, setDismissed] = useState(prefs.dismissed("getting-started"));
  const [push, setPush] = useState(false);
  useEffect(() => {
    void currentPushSubscription().then((s) => setPush(Boolean(s)));
  }, []);
  const passkeys = useQuery({ queryKey: ["passkeys"], queryFn: () => api<unknown[]>("/auth/passkeys"), enabled: !dismissed, staleTime: 300_000 });

  const steps = [
    { id: "plan", done: me.profile.training_days != null, label: "Pick your training days", detail: "The other days show as planned rest, not gaps.", to: "/settings/training" },
    { id: "log", done: sessions > 0, label: "Log your first session", detail: "Ten seconds. Anything counts.", action: onLog },
    // The first two weeks predict everything after them: three days in the
    // first fortnight is the habit starting. Shown only while it can still
    // be done, so it never turns into a failure to look at.
    ...(firstFortnight && (firstFortnight.open || firstFortnight.days >= 3)
      ? [
          {
            id: "habit",
            done: firstFortnight.days >= 3,
            label: "Three days in your first two weeks",
            detail: `${Math.min(3, firstFortnight.days)} of 3 so far. Short sessions count; that's the point.`,
            action: onLog,
          },
        ]
      : []),
    { id: "nudge", done: push || isStandalone(), label: "Get reminders", detail: "Install the app or turn on notifications.", to: "/settings/notifications" },
    { id: "secure", done: me.user.totp_enabled || (passkeys.data?.length ?? 0) > 0, label: "Secure your account", detail: "Add a passkey: sign in with your fingerprint or face.", to: "/settings/security" },
  ];
  const done = steps.filter((s) => s.done).length;
  if (dismissed || done === steps.length) return null;

  return (
    <section className="card mb-4 p-4" aria-labelledby="getting-started">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="getting-started" className="font-semibold">Getting started</h2>
          <p className="text-sm text-dim">
            {done} of {steps.length} done
          </p>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-icon btn-sm"
          aria-label="Hide getting started"
          onClick={() => {
            prefs.dismiss("getting-started");
            setDismissed(true);
          }}
        >
          <X size={16} />
        </button>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-3" aria-hidden>
        <span className="block h-full bg-accent" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ul className="mt-3 divide-y divide-line">
        {steps.map((s) => {
          const body = (
            <>
              {s.done ? <CheckCircle size={20} weight="fill" className="shrink-0 text-accent-text" aria-hidden /> : <Circle size={20} className="shrink-0 text-dim" aria-hidden />}
              <span className="min-w-0 flex-1">
                <span className={`block font-medium ${s.done ? "text-dim line-through" : ""}`}>{s.label}</span>
                {!s.done && <span className="block text-sm text-dim">{s.detail}</span>}
              </span>
              <span className="sr-only">{s.done ? "Done" : "Not done yet"}</span>
            </>
          );
          const cls = "press flex w-full items-center gap-3 py-2.5 text-left";
          return (
            <li key={s.id}>
              {s.done ? (
                <div className={cls}>{body}</div>
              ) : s.action ? (
                <button type="button" className={cls} onClick={s.action}>
                  {body}
                </button>
              ) : (
                <Link to={s.to!} className={cls}>
                  {body}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
