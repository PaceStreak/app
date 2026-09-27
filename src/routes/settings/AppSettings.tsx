import { useEffect, useState } from "react";
import { useConfirm } from "../../components/Confirm";
import { DownloadSimple, Moon, Sun, CircleHalf } from "../../components/phosphor";
import { toast } from "../../components/toast";
import { Section, Segmented, Switch } from "../../components/ui";
import { wipe } from "../../lib/db";
import { prefs, type BadgeMode, type Theme } from "../../lib/prefs";
import { canInstall, install, isStandalone, onInstallChange } from "../../lib/pwa";
import { syncNow } from "../../lib/sync";
import { useSyncState } from "../../lib/queries";

export function Appearance() {
  const [theme, setTheme] = useState<Theme>(prefs.theme());
  const [, bump] = useState(0);
  const flip = (fn: (v: boolean) => void, v: boolean) => {
    fn(v);
    bump((n) => n + 1);
  };
  return (
    <div>
      <Section title="Theme" className="mt-0">
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["system", "Automatic", CircleHalf],
              ["dark", "Dark", Moon],
              ["light", "Light", Sun],
            ] as const
          ).map(([v, label, Icon]) => (
            <button
              key={v}
              type="button"
              aria-pressed={theme === v}
              onClick={() => {
                prefs.setTheme(v);
                setTheme(v);
              }}
              className={`press flex flex-col items-center gap-2 rounded-md border py-4 text-sm font-semibold ${theme === v ? "border-accent-text bg-accent-soft" : "border-line bg-surface"}`}
            >
              <Icon size={22} /> {label}
            </button>
          ))}
        </div>
        <p className="field-hint">Light is easier to read in bright sun at a trailhead.</p>
      </Section>
      <BadgeSetting />
      <Section title="During workouts">
        <div className="card divide-y divide-line">
          <Switch checked={prefs.autoRest()} onChange={(v) => flip(prefs.setAutoRest, v)} label="Start the rest timer when a set is done" />
          <Switch
            checked={prefs.autofill()}
            onChange={(v) => flip(prefs.setAutofill, v)}
            label="Fill in the suggested weight"
            description="Ticking an empty set logs the suggestion (including a step back after a stall) instead of last time's numbers."
          />
          <Switch checked={prefs.keepAwake()} onChange={(v) => flip(prefs.setKeepAwake, v)} label="Keep the screen on" description="Only while a workout is open." />
          <Switch checked={prefs.haptics()} onChange={(v) => flip(prefs.setHaptics, v)} label="Vibration" />
          <Switch checked={prefs.sound()} onChange={(v) => flip(prefs.setSound, v)} label="Sound when rest is up" />
        </div>
      </Section>
    </div>
  );
}

export function AppSection() {
  const sync = useSyncState();
  const [installable, setInstallable] = useState(canInstall());
  const [confirmSheet, ask] = useConfirm();
  useEffect(() => onInstallChange(() => setInstallable(canInstall())), []);
  return (
    <div>
      <Section title="Install" className="mt-0">
        {isStandalone() ? (
          <p className="text-muted">Installed. You're using the app version.</p>
        ) : installable ? (
          <button
            type="button"
            className="btn btn-primary w-full"
            onClick={async () => {
              const r = await install();
              if (r === "ios") toast("Tap Share, then Add to Home Screen", { duration: 8000 });
            }}
          >
            <DownloadSimple size={18} /> Install PaceStreak
          </button>
        ) : (
          <p className="text-muted">Use your browser's menu and choose Install or Add to Home Screen.</p>
        )}
      </Section>
      <Section title="Sync">
        <div className="card p-4">
          <p className="font-medium">{sync.pending ? `${sync.pending} change${sync.pending === 1 ? "" : "s"} waiting to sync` : "Everything is synced"}</p>
          <p className="text-sm text-dim">{sync.lastSyncedAt ? `Last synced ${new Date(sync.lastSyncedAt).toLocaleTimeString()}` : "Not synced this session yet"}</p>
          <button type="button" className="btn btn-secondary btn-sm mt-3" onClick={() => void syncNow()}>
            Sync now
          </button>
        </div>
      </Section>
      <Section title="This device">
        <button
          type="button"
          className="btn btn-secondary w-full"
          onClick={async () => {
            if (sync.pending && !(await ask({ title: "Unsynced changes will be lost", body: `${sync.pending} change(s) haven't reached the server yet.`, confirm: "Clear anyway", danger: true }))) return;
            await wipe();
            window.location.reload();
          }}
        >
          Clear data stored on this device
        </button>
        <p className="field-hint">Your account is untouched; everything downloads again.</p>
      </Section>
      {confirmSheet}
    </div>
  );
}

export function About() {
  return (
    <div className="space-y-4 text-muted">
      <p>PaceStreak is a workout streak tracker built in the open. The whole thing is AGPL-3.0.</p>
      <ul className="card divide-y divide-line">
        {[
          ["Privacy policy", "https://www.pacestreak.com/privacy"],
          ["Terms", "https://www.pacestreak.com/terms"],
          ["Build log", "https://blog.pacestreak.com"],
          ["Service status", "https://status.pacestreak.com"],
          ["Contact", "mailto:hello@pacestreak.com"],
        ].map(([label, href]) => (
          <li key={href}>
            <a href={href} target="_blank" rel="noopener" className="block px-4 py-3.5 text-ink hover:bg-surface-2/60">
              {label}
            </a>
          </li>
        ))}
      </ul>
      <p className="text-sm">Not medical advice. If something hurts, rest; a freeze or a repair will look after the streak.</p>
    </div>
  );
}

/** Only shown where the browser can badge an installed app's icon. */
function BadgeSetting() {
  const [mode, setMode] = useState(prefs.badge());
  if (!("setAppBadge" in navigator)) return null;
  return (
    <Section title="App icon badge">
      <Segmented
        label="App icon badge"
        value={mode}
        onChange={(m: BadgeMode) => {
          prefs.setBadge(m);
          setMode(m);
        }}
        options={[
          { value: "unread", label: "Unread" },
          { value: "needed", label: "Days to go" },
          { value: "off", label: "Off" },
        ]}
      />
      <p className="field-hint">
        {mode === "needed" ? "How many more days this week keep your main streak. Hidden while you're paused." : mode === "unread" ? "Unread notifications." : "No number on the icon."}
      </p>
    </Section>
  );
}
