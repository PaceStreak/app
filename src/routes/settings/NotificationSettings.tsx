import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { BellSlash } from "../../components/phosphor";
import { toast } from "../../components/toast";
import { Banner, Section, Switch } from "../../components/ui";
import { api, errorText } from "../../lib/api";
import { currentPushSubscription, disablePush, enablePush, pushSupported } from "../../lib/pwa";
import { useMe } from "../../lib/session";
import { useProfilePatch } from "./useProfilePatch";

interface Prefs {
  categories: { id: string; label: string; locked: boolean; push: boolean; email: boolean }[];
  push_available: boolean;
}

const hours = Array.from({ length: 24 }, (_, h) => h);
const hourLabel = (h: number) => new Date(2026, 0, 1, h).toLocaleTimeString(undefined, { hour: "numeric" });

export function NotificationSettings() {
  const me = useMe();
  const save = useProfilePatch();
  const q = useQuery({ queryKey: ["notification-prefs"], queryFn: () => api<Prefs>("/notifications/preferences") });
  const [pushOn, setPushOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const permission = typeof Notification !== "undefined" ? Notification.permission : "denied";

  useEffect(() => {
    void currentPushSubscription().then((s) => setPushOn(Boolean(s)));
  }, []);

  const toggle = async (id: string, channel: "push" | "email", value: boolean) => {
    const channels = Object.fromEntries((q.data?.categories ?? []).map((c) => [c.id, { push: c.push, email: c.email }]));
    channels[id] = { ...channels[id], [channel]: value };
    try {
      await api("/notifications/preferences", { method: "PUT", body: { channels } });
      await q.refetch();
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const togglePush = async () => {
    setBusy(true);
    try {
      if (pushOn) {
        await disablePush();
        setPushOn(false);
      } else if (me.push_public_key) {
        const result = await enablePush(me.push_public_key);
        if (result === "denied") toast.error("Notifications are blocked for this site in your browser settings");
        setPushOn(result === "granted");
      }
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Section title="This device" className="mt-0">
        {!pushSupported() || !q.data?.push_available ? (
          <Banner icon={<BellSlash size={18} />}>
            {!pushSupported() ? "This browser can't receive push notifications. On iPhone, install PaceStreak to your home screen first." : "Push isn't set up on this server. In-app and email still work."}
          </Banner>
        ) : (
          <div className="card flex items-center gap-3 p-4">
            <div className="flex-1">
              <p className="font-semibold">Push notifications</p>
              <p className="text-sm text-dim">{permission === "denied" ? "Blocked in browser settings" : pushOn ? "On for this device" : "Off for this device"}</p>
            </div>
            {pushOn && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => void api("/notifications/push/test", { method: "POST" }).then(() => toast("Sent a test"))}>
                Test
              </button>
            )}
            <button type="button" className={`btn btn-sm ${pushOn ? "btn-secondary" : "btn-primary"}`} disabled={busy || permission === "denied"} onClick={togglePush}>
              {pushOn ? "Turn off" : "Turn on"}
            </button>
          </div>
        )}
      </Section>

      <Section title="What you hear about">
        <div className="card overflow-hidden">
          <div className="grid grid-cols-[1fr_56px_56px] items-center border-b border-line px-4 py-2 text-xs font-semibold text-dim">
            <span>Everything lands in your inbox. Plus:</span>
            <span className="text-center">Push</span>
            <span className="text-center">Email</span>
          </div>
          {(q.data?.categories ?? []).map((c) => (
            <div key={c.id} className="grid grid-cols-[1fr_56px_56px] items-center border-b border-line px-4 py-3 last:border-0">
              <span>
                <span className="block font-medium">{c.label}</span>
                {c.locked && <span className="text-xs text-dim">Always emailed, so you hear about anyone else touching your account.</span>}
              </span>
              <span className="flex justify-center">
                <button type="button" role="switch" aria-checked={c.push} aria-label={`${c.label} push`} className="switch" data-on={c.push} onClick={() => void toggle(c.id, "push", !c.push)} />
              </span>
              <span className="flex justify-center">
                <button type="button" role="switch" aria-checked={c.email} aria-label={`${c.label} email`} disabled={c.locked} className="switch disabled:opacity-50" data-on={c.email} onClick={() => void toggle(c.id, "email", !c.email)} />
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Timing">
        <div className="card space-y-4 p-4">
          <div className="-mx-4 -mt-4 border-b border-line">
            <Switch
              checked={me.profile.reminder_mode === "smart"}
              onChange={(v) => void save({ reminder_mode: v ? "smart" : "fixed" })}
              label="Remind me before I usually train"
              description={
                me.profile.reminder_mode === "smart"
                  ? me.profile.learned_reminder_hour != null
                    ? `You usually train around ${hourLabel((me.profile.learned_reminder_hour + 1) % 24)}, so reminders come at ${hourLabel(me.profile.learned_reminder_hour)}.`
                    : "Not enough sessions yet to spot a habit. Until then, the time below is used."
                  : "Learns from the times you log sessions. Never during quiet hours."
              }
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="rem-h" className="font-medium">{me.profile.reminder_mode === "smart" ? "Fallback time" : "Reminder time"}</label>
            <select id="rem-h" className="input h-10 min-h-0 w-32" value={me.profile.reminder_hour} onChange={(e) => void save({ reminder_hour: Number(e.target.value) })}>
              {hours.map((h) => (
                <option key={h} value={h}>{hourLabel(h)}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium">Quiet hours</span>
            <span className="flex items-center gap-2">
              <select className="input h-10 min-h-0 w-28" value={me.profile.quiet_start} onChange={(e) => void save({ quiet_start: Number(e.target.value) })} aria-label="Quiet from">
                {hours.map((h) => (
                  <option key={h} value={h}>{hourLabel(h)}</option>
                ))}
              </select>
              <span className="text-dim">to</span>
              <select className="input h-10 min-h-0 w-28" value={me.profile.quiet_end} onChange={(e) => void save({ quiet_end: Number(e.target.value) })} aria-label="Quiet until">
                {hours.map((h) => (
                  <option key={h} value={h}>{hourLabel(h)}</option>
                ))}
              </select>
            </span>
          </div>
          <p className="text-sm text-dim">No push during quiet hours, apart from security alerts. Streak nudges come at most once a day and never on a week you've already kept.</p>
        </div>
      </Section>
    </div>
  );
}
