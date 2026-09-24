import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Field } from "../../components/ui";
import { api, errorText } from "../../lib/api";
import { useSession } from "../../lib/session";
import { AuthLayout, PasswordField } from "./AuthLayout";

type Tokens = { access_token: string; expires_in: number; csrf_token?: string };
type Challenge = { mfa_token: string; expires_in: number };

export default function Login() {
  const { signIn } = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfa, setMfa] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const done = async (tokens: Tokens) => {
    const me = await signIn(tokens);
    const next = params.get("next");
    navigate(me?.needs_onboarding ? "/welcome" : next && next.startsWith("/") ? next : "/", { replace: true });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mfa) {
        await done(await api<Tokens>("/auth/2fa/verify", { body: { mfa_token: mfa, code: code.replace(/\s/g, "") }, auth: false }));
      } else {
        const res = await api<Tokens | Challenge>("/auth/login", { body: { email, password }, auth: false });
        if ("mfa_token" in res) setMfa(res.mfa_token);
        else await done(res);
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  if (mfa) {
    return (
      <AuthLayout title="Two-factor code" subtitle="Open your authenticator app, or use one of your recovery codes.">
        <form onSubmit={submit} className="space-y-5">
          <Field
            label="Code"
            inputMode="text"
            autoComplete="one-time-code"
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            error={error}
            placeholder="123 456"
            required
          />
          <button className="btn btn-primary w-full" disabled={busy || code.length < 6}>
            {busy ? "Checking…" : "Sign in"}
          </button>
          <button type="button" className="btn btn-ghost w-full" onClick={() => setMfa(null)}>
            Back
          </button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Welcome back."
      subtitle="Log in to keep the streak going."
      footer={
        <>
          New here?{" "}
          <Link to="/signup" className="font-semibold text-accent-text">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5">
        <Field label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        <PasswordField value={password} onChange={setPassword} autoComplete="current-password" />
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn-primary w-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p className="text-center text-sm">
          <Link to="/forgot-password" className="text-muted underline">
            Forgot your password?
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
