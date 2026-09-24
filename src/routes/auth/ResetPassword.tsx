import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { api, errorText } from "../../lib/api";
import { AuthLayout, PasswordField } from "./AuthLayout";

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
    return <AuthLayout title="That link is incomplete." subtitle="Open the link from the email again, or ask for a new one." footer={<Link to="/forgot-password" className="font-semibold text-accent-text">Request a new link</Link>} />;
  }
  return (
    <AuthLayout
      title={done ? "Password updated." : "Choose a new password."}
      subtitle={done ? "Every other session was signed out, which is the point of a reset." : undefined}
      footer={<Link to="/login" className="font-semibold text-accent-text">Sign in</Link>}
    >
      {!done && (
        <form onSubmit={submit} className="space-y-5">
          <PasswordField value={password} onChange={setPassword} autoComplete="new-password" label="New password" error={error} hint="At least 16 characters." />
          <button className="btn btn-primary w-full" disabled={busy || password.length < 16}>
            {busy ? "Saving…" : "Set password"}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
