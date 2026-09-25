import { useState } from "react";
import { Link, useLocation } from "react-router";
import { api, errorText } from "../lib/api";
import { t } from "../lib/i18n";
import { rich } from "../lib/i18n-rich";
import { useSession } from "../lib/session";
import { toast } from "./toast";

/**
 * Shown over everything when the terms changed since this account accepted
 * them. Not dismissible - but it never blocks the way out: exporting your
 * data (and the privacy and terms pages themselves) stay one tap away.
 */
export function TermsGate() {
  const { me, reloadMe } = useSession();
  const [busy, setBusy] = useState(false);
  const location = useLocation();
  // Step aside on the export screen, so "export my data first" really works;
  // it comes back on the next screen.
  if (!me?.needs_terms || location.pathname === "/settings/data") return null;
  const accept = async () => {
    setBusy(true);
    try {
      await api("/me/terms", { body: { version: me.terms_version } });
      await reloadMe();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  const link = (href: string) => (text: string) => (
    <a className="font-semibold text-accent-text underline" href={href} target="_blank" rel="noopener">
      {text}
    </a>
  );
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--scrim)] p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="terms-title">
      <div className="card-raised w-full max-w-[460px] p-5">
        <h2 id="terms-title" className="text-xl font-semibold tracking-tight">
          {t("terms.title")}
        </h2>
        <p className="mt-2 text-muted">{rich("terms.body", { terms: link("https://www.pacestreak.com/terms"), privacy: link("https://www.pacestreak.com/privacy") })}</p>
        <div className="mt-5 flex flex-col gap-2">
          <button type="button" className="btn btn-primary w-full" disabled={busy} onClick={() => void accept()} autoFocus>
            {busy ? t("terms.busy") : t("terms.accept")}
          </button>
          <Link to="/settings/data" className="btn btn-ghost w-full">
            {t("terms.export")}
          </Link>
        </div>
      </div>
    </div>
  );
}
