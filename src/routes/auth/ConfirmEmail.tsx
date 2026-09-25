import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { api, errorText } from "../../lib/api";
import { t } from "../../lib/i18n";
import { useSession } from "../../lib/session";
import { AuthLayout } from "./AuthLayout";

/** The link sent to a new address when someone changes their email. */
export default function ConfirmEmail() {
  const [params] = useSearchParams();
  const { status, reloadMe } = useSession();
  const [state, setState] = useState<"working" | "done" | "error">("working");
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const token = params.get("token");
    if (!token) {
      setState("error");
      setError(t("auth.confirmEmail.noToken"));
      return;
    }
    api("/auth/confirm-email-change", { body: { token }, auth: false })
      .then(() => {
        setState("done");
        if (status === "ready") void reloadMe();
      })
      .catch((err) => {
        setState("error");
        setError(errorText(err));
      });
  }, [params, status, reloadMe]);
  return (
    <AuthLayout
      title={state === "working" ? t("auth.confirmEmail.working") : state === "done" ? t("auth.confirmEmail.doneTitle") : t("auth.confirmEmail.failTitle")}
      subtitle={state === "done" ? t("auth.confirmEmail.doneBody") : state === "error" ? t("auth.confirmEmail.failBody", { error: error ?? "" }) : undefined}
      footer={<Link to="/" className="font-semibold text-accent-text">{t("auth.verify.open")}</Link>}
    />
  );
}
