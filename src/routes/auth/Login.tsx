import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import { Fingerprint } from "../../components/phosphor";
import { Turnstile, type TurnstileHandle } from "../../components/Turnstile";
import { Field } from "../../components/ui";
import { api, ApiError, errorText } from "../../lib/api";
import { useEmailEnabled } from "../../lib/capabilities";
import { conditionalSupported, passkeysSupported, signInWithPasskey, wasCancelled } from "../../lib/passkeys";
import { type Challenge, challengeFromError, clock, isChallenge, normaliseCode, resendWait } from "../../lib/signin";
import { useSession } from "../../lib/session";
import { AuthLayout, PasswordField } from "./AuthLayout";
import { t } from "../../lib/i18n";
import { rich } from "../../lib/i18n-rich";

type Tokens = { access_token: string; expires_in: number; csrf_token?: string };

export default function Login() {
  const { signIn } = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [password, setPassword] = useState("");
  // Signup and verify-email sign in on the person's behalf; when that needs a code they hand the challenge here.
  const handed = (useLocation().state as { challenge?: unknown } | null)?.challenge;
  const [mfa, setMfa] = useState<Challenge | null>(isChallenge(handed) ? handed : null);
  const [code, setCode] = useState("");
  // Email-code step: trust is ticked by default; a recovery code can stand in for the mailed one.
  const [trust, setTrust] = useState(true);
  const [recovery, setRecovery] = useState(false);
  const [waitUntil, setWaitUntil] = useState(() => (isChallenge(handed) ? Date.now() + (handed.resend_in ?? 0) * 1000 : 0));
  const [now, setNow] = useState(Date.now);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const captchaRef = useRef<TurnstileHandle>(null);
  const emailEnabled = useEmailEnabled();

  const done = async (tokens: Tokens) => {
    const me = await signIn(tokens);
    const next = params.get("next");
    navigate(me?.needs_onboarding ? "/welcome" : next?.startsWith("/") && !next.startsWith("//") ? next : "/", { replace: true });
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

  const byEmail = mfa?.method === "email";
  const wait = Math.max(0, Math.ceil((waitUntil - now) / 1000));
  useEffect(() => {
    if (!byEmail || wait === 0) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [byEmail, wait]);

  const startChallenge = (c: Challenge) => {
    setMfa(c);
    setCode("");
    setRecovery(false);
    setNotice(null);
    setNow(Date.now());
    setWaitUntil(Date.now() + (c.resend_in ?? 0) * 1000);
  };

  const resend = async () => {
    if (!mfa) return;
    setError(null);
    setNotice(null);
    try {
      const res = await api<{ resend_in: number }>("/auth/2fa/resend", { body: { mfa_token: mfa.mfa_token }, auth: false });
      setNotice(t("auth.emailCode.resent"));
      setNow(Date.now());
      setWaitUntil(Date.now() + res.resend_in * 1000);
    } catch (err) {
      const s = resendWait(err);
      if (s !== null) {
        setNow(Date.now());
        setWaitUntil(Date.now() + s * 1000);
      }
      setError(errorText(err));
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mfa) {
        const body = { mfa_token: mfa.mfa_token, code: normaliseCode(code), ...(byEmail ? { trust_device: trust } : {}) };
        await done(await api<Tokens>("/auth/2fa/verify", { body, auth: false }));
      } else {
        const res = await api<Tokens | Challenge>("/auth/login", { body: { email, password, turnstile_token: captcha }, auth: false });
        if (isChallenge(res)) startChallenge(res);
        else await done(res);
      }
    } catch (err) {
      // The code email failed: the challenge still stands, and a recovery code can finish it.
      const stranded = mfa ? null : challengeFromError(err);
      if (stranded) {
        startChallenge(stranded);
        setRecovery(true);
        setError(errorText(err));
        return;
      }
      if (emailEnabled && err instanceof ApiError && err.status === 403) {
        // Unverified accounts have no way to reach the OTP entry field from
        // here - send them straight to it instead of a dead-end resend loop.
        navigate(`/verify-email?email=${encodeURIComponent(email)}`);
        return;
      }
      setError(errorText(err));
      captchaRef.current?.getFreshToken().then(setCaptcha).catch(() => setCaptcha(null));
    } finally {
      setBusy(false);
    }
  };

  if (mfa && byEmail) {
    return (
      <AuthLayout title={t("auth.emailCode.title")} subtitle={recovery ? t("auth.emailCode.subtitleRecovery") : t("auth.emailCode.subtitle", { email })}>
        <form onSubmit={submit} className="space-y-5">
          <Field
            key={recovery ? "recovery" : "email"}
            label={recovery ? t("auth.emailCode.recoveryCode") : t("auth.emailCode.code")}
            inputMode={recovery ? "text" : "numeric"}
            autoComplete="one-time-code"
            autoCapitalize={recovery ? "characters" : "off"}
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            error={error}
            placeholder={recovery ? "XXXXX-XXXXX" : "123 456"}
            required
          />
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={trust} onChange={(e) => setTrust(e.target.checked)} className="mt-0.5 size-5 accent-[var(--accent)]" />
            <span>
              <span className="block font-medium">{t("auth.emailCode.trust")}</span>
              <span className="block text-dim">{t("auth.emailCode.trustHint")}</span>
            </span>
          </label>
          {notice && (
            <p className="field-hint" role="status">
              {notice}
            </p>
          )}
          <button className="btn btn-primary w-full" disabled={busy || code.trim().length < 6}>
            {busy ? t("auth.mfa.busy") : t("auth.login.submit")}
          </button>
          <div className="flex flex-col items-center gap-2 text-sm">
            {!recovery && (
              <button type="button" className="text-muted underline disabled:no-underline disabled:opacity-70" onClick={() => void resend()} disabled={wait > 0}>
                {wait > 0 ? t("auth.emailCode.resendIn", { time: clock(wait) }) : t("auth.emailCode.resend")}
              </button>
            )}
            <button
              type="button"
              className="text-muted underline"
              onClick={() => {
                setRecovery(!recovery);
                setCode("");
                setError(null);
              }}
            >
              {recovery ? t("auth.emailCode.useEmail") : t("auth.emailCode.useRecovery")}
            </button>
          </div>
          <button type="button" className="btn btn-ghost w-full" onClick={() => setMfa(null)}>
            {t("common.back")}
          </button>
        </form>
      </AuthLayout>
    );
  }

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
        <button className="btn btn-primary w-full" disabled={busy}>
          {busy ? t("auth.login.busy") : t("auth.login.submit")}
        </button>
        {passkeysSupported() && (
          <button type="button" className="btn btn-secondary w-full" onClick={passkey} disabled={busy}>
            <Fingerprint size={18} aria-hidden /> {t("auth.login.passkey")}
          </button>
        )}
        <p className="flex flex-col items-center gap-2 text-sm">
          {/* Without email, a recovery code is how a forgotten password is reset. */}
          <Link to={emailEnabled ? "/forgot-password" : "/recover"} className="text-muted underline">
            {t("auth.login.forgot")}
          </Link>
          {emailEnabled && (
            <Link to="/recover" className="text-muted underline">
              {t("auth.login.lostAccess")}
            </Link>
          )}
        </p>
      </form>
    </AuthLayout>
  );
}
