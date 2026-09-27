import { useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { Turnstile, type TurnstileHandle } from "../../components/Turnstile";
import { Field } from "../../components/ui";
import { api, errorText } from "../../lib/api";
import { AuthLayout } from "./AuthLayout";
import { t } from "../../lib/i18n";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const captchaRef = useRef<TurnstileHandle>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api<{ detail: string }>("/auth/forgot-password", { body: { email, turnstile_token: captcha }, auth: false });
      navigate(`/reset-password?email=${encodeURIComponent(email)}`, { replace: true });
    } catch (err) {
      setError(errorText(err));
      captchaRef.current?.getFreshToken().then(setCaptcha).catch(() => setCaptcha(null));
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthLayout
      title={t("auth.forgot.title")}
      subtitle={t("auth.forgot.subtitle")}
      footer={<Link to="/login" className="font-semibold text-accent-text">{t("auth.forgot.back")}</Link>}
    >
      <form onSubmit={submit} className="space-y-5">
        <Field label={t("common.email")} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus error={error} />
        <Turnstile ref={captchaRef} onToken={setCaptcha} />
        <button className="btn btn-primary w-full" disabled={busy}>
          {busy ? t("auth.forgot.busy") : t("auth.forgot.submit")}
        </button>
      </form>
    </AuthLayout>
  );
}
