import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Field } from "../../components/ui";
import { api, errorText } from "../../lib/api";
import { t } from "../../lib/i18n";
import { useSession } from "../../lib/session";
import { AuthLayout } from "./AuthLayout";

/** Confirms a pending email change with the code sent to the new address. */
export default function ConfirmEmail() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { status, reloadMe } = useSession();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [code, setCode] = useState("");
  const [state, setState] = useState<"working" | "error">("working");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/auth/confirm-email-change", { body: { email, code }, auth: false });
      // Only reachable from settings while already signed in, so there's
      // always a session to refresh and an app to land back in.
      if (status === "ready") await reloadMe();
      navigate("/settings", { replace: true });
    } catch (err) {
      setState("error");
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title={t("auth.confirmEmail.title")}
      subtitle={state === "error" ? t("auth.confirmEmail.failBody", { error: error ?? "" }) : t("auth.confirmEmail.subtitle", { email: email || "the new address" })}
    >
      <form onSubmit={submit} className="space-y-5">
        <Field label={t("auth.confirmEmail.email")} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus={!email} />
        <Field
          label={t("auth.confirmEmail.code")}
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          required
          autoFocus={!!email}
        />
        <button className="btn btn-primary w-full" disabled={busy || code.length !== 6 || !email}>
          {busy ? t("auth.confirmEmail.working") : t("auth.confirmEmail.submit")}
        </button>
      </form>
    </AuthLayout>
  );
}
