import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { Field } from "../../components/ui";
import { api, errorText } from "../../lib/api";
import { AuthLayout } from "./AuthLayout";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ detail: string }>("/auth/forgot-password", { body: { email }, auth: false });
      setSent(res.detail);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthLayout
      title={sent ? "Check your inbox." : "Reset your password."}
      subtitle={sent ?? "We'll email you a link. It works once and expires in 30 minutes."}
      footer={<Link to="/login" className="font-semibold text-accent-text">Back to sign in</Link>}
    >
      {!sent && (
        <form onSubmit={submit} className="space-y-5">
          <Field label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus error={error} />
          <button className="btn btn-primary w-full" disabled={busy}>
            {busy ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
