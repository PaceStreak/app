import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Fingerprint } from "../../components/phosphor";
import { Turnstile, type TurnstileHandle } from "../../components/Turnstile";
import { Field } from "../../components/ui";
import { api, ApiError, errorText } from "../../lib/api";
import { conditionalSupported, passkeysSupported, signInWithPasskey, wasCancelled } from "../../lib/passkeys";
import { useSession } from "../../lib/session";
import { AuthLayout, PasswordField } from "./AuthLayout";
import { t } from "../../lib/i18n";
import { rich } from "../../lib/i18n-rich";

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
  const [needsVerify, setNeedsVerify] = useState(false);
  const [resent, setResent] = useState(false);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const captchaRef = useRef<TurnstileHandle>(null);

  const done = async (tokens: Tokens) => {
    const me = await signIn(tokens);
    const next = params.get("next");
    navigate(me?.needs_onboarding ? "/welcome" : next && next.startsWith("/") ? next : "/", { replace: true });
  };

  // Offer saved passkeys in the email field's autofill list. The request waits
  // silently until one is picked, and is aborted when the page goes away or
  // an explicit sign-in starts (a browser allows only one at a time).
  const [conditional, setConditional] = useState<AbortController | null>(null);
  useEffect(() => {
    let ctrl: AbortController | null = null;
    void conditionalSupported().then((ok) => {
      if (!ok) return;
      ctrl = new AbortController();
      setConditional(ctrl);
      signInWithPasskey({ conditional: true, signal: ctrl.signal })
        .then(done)
        // The autofill request runs in the background, unasked. If it fails
        // (no passkeys on this device, an unsupported browser), say nothing:
        // the person hasn't done anything yet. The passkey button reports
        // its own errors.
        .catch(() => undefined);
    });
    return () => ctrl?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const passkey = async () => {
    conditional?.abort();
    setBusy(true);
    setError(null);
    try {
      await done(await signInWithPasskey());
    } catch (err) {
      if (!wasCancelled(err)) setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNeedsVerify(false);
    try {
      if (mfa) {
        await done(await api<Tokens>("/auth/2fa/verify", { body: { mfa_token: mfa, code: code.replace(/\s/g, "") }, auth: false }));
      } else {
        const res = await api<Tokens | Challenge>("/auth/login", { body: { email, password, turnstile_token: captcha }, auth: false });
        if ("mfa_token" in res) setMfa(res.mfa_token);
        else await done(res);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setNeedsVerify(true);
      setError(errorText(err));
      captchaRef.current?.getFreshToken().then(setCaptcha).catch(() => setCaptcha(null));
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

  if (mfa) {
    return (
      <AuthLayout title={t("auth.mfa.title")} subtitle={t("auth.mfa.subtitle")}>
        <form onSubmit={submit} className="space-y-5">
          <Field
            label={t("auth.mfa.code")}
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
            {busy ? t("auth.mfa.busy") : t("auth.login.submit")}
          </button>
          <button type="button" className="btn btn-ghost w-full" onClick={() => setMfa(null)}>
            {t("common.back")}
          </button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t("auth.login.title")}
      subtitle={t("auth.login.subtitle")}
      footer={rich("auth.login.newHere", {
        signup: (text) => (
          <Link to="/signup" className="font-semibold text-accent-text">
            {text}
          </Link>
        ),
      })}
    >
      <form onSubmit={submit} className="space-y-5">
        <Field label={t("common.email")} type="email" autoComplete="username webauthn" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        <PasswordField value={password} onChange={setPassword} autoComplete="current-password" />
        <Turnstile ref={captchaRef} onToken={setCaptcha} />
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        {needsVerify && (
          <button type="button" className="btn btn-secondary w-full" onClick={() => void resend()} disabled={busy || resent}>
            {resent ? t("auth.verify.resent") : t("auth.verify.resend")}
          </button>
        )}
        <button className="btn btn-primary w-full" disabled={busy}>
          {busy ? t("auth.login.busy") : t("auth.login.submit")}
        </button>
        {passkeysSupported() && (
          <button type="button" className="btn btn-secondary w-full" onClick={passkey} disabled={busy}>
            <Fingerprint size={18} aria-hidden /> {t("auth.login.passkey")}
          </button>
        )}
        <p className="flex flex-col items-center gap-2 text-sm">
          <Link to="/forgot-password" className="text-muted underline">
            {t("auth.login.forgot")}
          </Link>
          <Link to="/recover" className="text-muted underline">
            {t("auth.login.lostAccess")}
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
