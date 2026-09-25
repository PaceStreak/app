import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { api, errorText } from "../../lib/api";
import { useSession } from "../../lib/session";
import { AuthLayout } from "./AuthLayout";
import { t } from "../../lib/i18n";

export default function VerifyEmail() {
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
      setError(t("auth.verify.noToken"));
      return;
    }
    api("/auth/verify-email", { body: { token }, auth: false })
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
      title={state === "working" ? t("auth.verify.working") : state === "done" ? t("auth.verify.doneTitle") : t("auth.verify.failTitle")}
      subtitle={state === "done" ? t("auth.verify.doneBody") : state === "error" ? t("auth.verify.failBody", { error: error ?? "" }) : undefined}
      footer={<Link to="/" className="font-semibold text-accent-text">{t("auth.verify.open")}</Link>}
    />
  );
}
