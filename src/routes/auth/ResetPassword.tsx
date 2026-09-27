import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { Field } from "../../components/ui";
import { api, errorText } from "../../lib/api";
import { AuthLayout, PasswordField } from "./AuthLayout";
import { t } from "../../lib/i18n";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/auth/reset-password", { body: { email, code, new_password: password }, auth: false });
      setDone(true);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthLayout
      title={done ? t("auth.reset.doneTitle") : t("auth.reset.title")}
      subtitle={done ? t("auth.reset.doneBody") : t("auth.reset.subtitle")}
      footer={<Link to="/login" className="font-semibold text-accent-text">{t("common.signIn")}</Link>}
    >
      {!done && (
        <form onSubmit={submit} className="space-y-5">
          <Field label={t("auth.reset.email")} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus={!email} />
          <Field
            label={t("auth.reset.code")}
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            required
            autoFocus={!!email}
          />
          <PasswordField value={password} onChange={setPassword} autoComplete="new-password" label={t("auth.reset.newPassword")} error={error} hint={t("auth.reset.hint")} />
          <button className="btn btn-primary w-full" disabled={busy || password.length < 16 || code.length !== 6 || !email}>
            {busy ? t("auth.reset.busy") : t("auth.reset.submit")}
          </button>
          <Link to="/forgot-password" className="block text-center text-sm font-semibold text-accent-text">
            {t("auth.reset.requestNew")}
          </Link>
        </form>
      )}
    </AuthLayout>
  );
}
