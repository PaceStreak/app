import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { Field } from "../../components/ui";
import { api, errorText } from "../../lib/api";
import { useSession } from "../../lib/session";
import { AuthLayout, PasswordField } from "./AuthLayout";

export default function Signup() {
  const { signIn } = useSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const short = password.length > 0 && password.length < 16;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 16) return;
    setBusy(true);
    setError(null);
    try {
      await api("/auth/signup", { body: { email, password }, auth: false });
      // Signup does not sign in by design; do it straight away so the next
      // screen is onboarding, not a second form.
      const tokens = await api<{ access_token: string; expires_in: number; csrf_token?: string }>("/auth/login", {
        body: { email, password },
        auth: false,
      });
      await signIn(tokens);
      navigate("/welcome", { replace: true });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Start your first streak."
      subtitle="Ten seconds a session. Rest days never break it."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-accent-text">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5">
        <Field label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        <PasswordField
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          error={short ? `${16 - password.length} more characters` : null}
          hint="At least 16 characters. A short sentence is easier to remember than symbols."
        />
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn-primary w-full" disabled={busy || password.length < 16}>
          {busy ? "Creating…" : "Create account"}
        </button>
        <p className="text-center text-sm text-dim">
          By continuing you agree to the{" "}
          <a className="underline" href="https://www.pacestreak.com/terms" target="_blank" rel="noopener">
            terms
          </a>{" "}
          and{" "}
          <a className="underline" href="https://www.pacestreak.com/privacy" target="_blank" rel="noopener">
            privacy policy
          </a>
          .
        </p>
      </form>
    </AuthLayout>
  );
}
