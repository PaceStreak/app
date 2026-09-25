import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { api, errorText } from "../../lib/api";
import { AuthLayout, PasswordField } from "./AuthLayout";
import { t } from "../../lib/i18n";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/auth/reset-password", { body: { token, new_password: password }, auth: false });
      setDone(true);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  if (!token) {
    return <AuthLayout title={t("auth.reset.incompleteTitle")} subtitle={t("auth.reset.incompleteBody")} footer={<Link to="/forgot-password" className="font-semibold text-accent-text">{t("auth.reset.requestNew")}</Link>} />;
  }
  return (
    <AuthLayout
      title={done ? t("auth.reset.doneTitle") : t("auth.reset.title")}
      subtitle={done ? t("auth.reset.doneBody") : undefined}
      footer={<Link to="/login" className="font-semibold text-accent-text">{t("common.signIn")}</Link>}
    >
      {!done && (
        <form onSubmit={submit} className="space-y-5">
          <PasswordField value={password} onChange={setPassword} autoComplete="new-password" label={t("auth.reset.newPassword")} error={error} hint={t("auth.reset.hint")} />
          <button className="btn btn-primary w-full" disabled={busy || password.length < 16}>
            {busy ? t("auth.reset.busy") : t("auth.reset.submit")}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
