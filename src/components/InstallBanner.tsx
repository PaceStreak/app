import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { DownloadSimple, X } from "./phosphor";
import { toast } from "./toast";
import { canInstall, install, isIos, onInstallChange } from "../lib/pwa";
import { prefs } from "../lib/prefs";
import { onOutcome } from "../lib/sync";
import { installMoment, markInstallMoment, recordVisit, type InstallMoment } from "../lib/installMoments";

const COPY: Record<InstallMoment, { title: string; body: string }> = {
  welcome: { title: "Install PaceStreak", body: "Opens like an app, works without signal, one tap from your home screen." },
  return: { title: "Back again? Keep it one tap away", body: "Install PaceStreak and it opens instantly, even offline." },
  logged: { title: "First session in. Nice.", body: "Install PaceStreak so the next one is two taps from your home screen." },
};

/**
 * The install offer, at three moments, each shown at most once on this
 * device: the first visit after signing in, the first visit on a later day,
 * and right after the first logged session. "Not now" uses up that moment
 * only; the next one can still come. Settings > App and the Today card stay
 * as the way to install whenever someone wants to.
 */
export function InstallBanner() {
  const location = useLocation();
  const [installable, setInstallable] = useState(canInstall());
  const [moment, setMoment] = useState<InstallMoment | null>(null);

  useEffect(() => onInstallChange(() => setInstallable(canInstall())), []);
  useEffect(() => setMoment(installMoment(recordVisit())), []);
  useEffect(
    () =>
      onOutcome(() => {
        if (installMoment(null, true) === "logged") setMoment("logged");
      }),
    [],
  );

  const visible = !!moment && installable && !location.pathname.startsWith("/workouts/live");
  // Shown once is used up, so an ignored welcome doesn't come back as itself.
  useEffect(() => {
    if (visible && moment) markInstallMoment(moment);
  }, [visible, moment]);

  if (!visible || !moment) return null;
  const copy = COPY[moment];

  const close = () => {
    // Give the Today card a rest too, so the same offer doesn't follow.
    prefs.dismissInstall();
    setMoment(null);
  };

  return (
    <div
      role="region"
      aria-label="Install the app"
      className="fixed inset-x-3 bottom-[calc(84px+env(safe-area-inset-bottom))] z-30 mx-auto max-w-[520px] lg:inset-x-auto lg:right-6 lg:bottom-6 lg:w-[380px]"
    >
      <div className="card flex items-start gap-3 p-4 shadow-lg">
        <DownloadSimple size={22} className="mt-0.5 shrink-0 text-accent" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{copy.title}</p>
          <p className="text-sm text-muted">
            {isIos() ? "Tap Share in Safari, then Add to Home Screen." : copy.body}
          </p>
          <div className="mt-3 flex gap-2">
            {!isIos() && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={async () => {
                  const r = await install();
                  if (r === "ios") toast("Tap Share, then Add to Home Screen", { duration: 8000 });
                  setMoment(null);
                  setInstallable(canInstall());
                }}
              >
                Install
              </button>
            )}
            <button type="button" className="btn btn-ghost btn-sm" onClick={close}>
              {isIos() ? "Got it" : "Not now"}
            </button>
          </div>
        </div>
        <button type="button" className="btn btn-ghost btn-icon -mt-1 -mr-1 shrink-0" aria-label="Dismiss" onClick={close}>
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
