import { useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { Turnstile, type TurnstileHandle } from "../../components/Turnstile";
import { Field } from "../../components/ui";
import { api, errorText } from "../../lib/api";
import { useSession } from "../../lib/session";
import { AuthLayout } from "./AuthLayout";
import { t } from "../../lib/i18n";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const { status, reloadMe } = useSession();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [code, setCode] = useState("");
  const [state, setState] = useState<"working" | "done" | "error">("working");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState(false);
  const captchaRef = useRef<TurnstileHandle>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/auth/verify-email", { body: { email, code }, auth: false });
      setState("done");
      if (status === "ready") void reloadMe();
    } catch (err) {
      setState("error");
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setBusy(true);
    try {
      const token = await captchaRef.current?.getFreshToken().catch(() => null);
      await api("/auth/resend-verification", { body: { email, turnstile_token: token }, auth: false });
      setResent(true);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  if (state === "done") {
    return (
      <AuthLayout
        title={t("auth.verify.doneTitle")}
        subtitle={t("auth.verify.doneBody")}
        footer={<Link to="/" className="font-semibold text-accent-text">{t("auth.verify.open")}</Link>}
      />
    );
  }

  return (
    <AuthLayout
      title={t("auth.verify.title")}
      subtitle={state === "error" ? t("auth.verify.failBody", { error: error ?? "" }) : t("auth.verify.subtitle", { email: email || "your address" })}
    >
      <form onSubmit={submit} className="space-y-5">
        <Field label={t("auth.verify.email")} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus={!email} />
        <Field
          label={t("auth.verify.code")}
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          required
          autoFocus={!!email}
        />
        <button className="btn btn-primary w-full" disabled={busy || code.length !== 6 || !email}>
          {busy ? t("auth.verify.working") : t("auth.verify.submit")}
        </button>
        <Turnstile ref={captchaRef} onToken={() => {}} />
        <button type="button" className="btn btn-secondary w-full" onClick={resend} disabled={busy || !email}>
          {resent ? t("auth.verify.resent") : t("auth.verify.resend")}
        </button>
      </form>
    </AuthLayout>
  );
}
