import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { Field } from "../../components/ui";
import { api, errorText } from "../../lib/api";
import { t } from "../../lib/i18n";
import { rich } from "../../lib/i18n-rich";
import { AuthLayout, PasswordField } from "./AuthLayout";

/** Set a new password with a 2FA recovery code: for someone who has lost
 * both the password and the mailbox. */
export default function Recover() {
  const [email, setEmail] = useState("");
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
      await api("/auth/recover", { body: { email, recovery_code: code.trim(), new_password: password }, auth: false });
      setDone(true);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return <AuthLayout title={t("auth.recover.doneTitle")} subtitle={t("auth.recover.doneBody")} footer={<Link to="/login" className="font-semibold text-accent-text">{t("common.signIn")}</Link>} />;
  }
  return (
    <AuthLayout title={t("auth.recover.title")} subtitle={t("auth.recover.subtitle")} footer={<Link to="/login" className="font-semibold text-accent-text">{t("auth.forgot.back")}</Link>}>
      <form onSubmit={submit} className="space-y-5">
        <Field label={t("common.email")} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        <Field label={t("auth.recover.code")} autoComplete="off" autoCapitalize="none" spellCheck={false} value={code} onChange={(e) => setCode(e.target.value)} required />
        <PasswordField value={password} onChange={setPassword} autoComplete="new-password" label={t("auth.recover.newPassword")} hint={t("auth.recover.hint")} error={error} />
        <button className="btn btn-primary w-full" disabled={busy || password.length < 16 || code.trim().length < 6}>
          {busy ? t("auth.recover.busy") : t("auth.recover.submit")}
        </button>
        <p className="text-sm text-dim">
          {rich("auth.recover.noCodes", {
            mail: (text) => (
              <a className="underline" href="mailto:hello@pacestreak.com">
                {text}
              </a>
            ),
          })}
        </p>
      </form>
    </AuthLayout>
  );
}
