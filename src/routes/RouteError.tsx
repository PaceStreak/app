import { useEffect } from "react";
import { useRouteError } from "react-router";
import { WarningCircle } from "../components/phosphor";
import { reportError } from "../lib/errors";

/** What a crashed screen shows instead of React Router's bare default. The
 * crash is reported (anonymously) so it can be fixed. */
export default function RouteError() {
  const error = useRouteError();
  useEffect(() => reportError(error, "route"), [error]);
  // A new deploy can make an old tab's lazy chunk vanish; a reload fixes it.
  const stale = error instanceof Error && /Failed to fetch dynamically imported module|Importing a module script failed/.test(error.message);
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-[420px] flex-col items-center justify-center px-6 text-center">
      <WarningCircle size={40} className="text-flame-text" aria-hidden />
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">{stale ? "PaceStreak was updated" : "Something broke on this screen"}</h1>
      <p className="mt-2 text-muted">
        {stale ? "Reload to get the new version. Nothing you logged is lost." : "It's been reported. Your logged sessions are safe on this device. Try again, or go back to Today."}
      </p>
      <div className="mt-6 flex w-full gap-2">
        <button type="button" className="btn btn-primary flex-1" onClick={() => location.reload()}>
          Reload
        </button>
        <a className="btn btn-secondary flex-1" href="/">
          Today
        </a>
      </div>
    </main>
  );
}
