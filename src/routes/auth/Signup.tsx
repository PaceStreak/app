import { useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { Turnstile, type TurnstileHandle } from "../../components/Turnstile";
import { Field } from "../../components/ui";
import { api, ApiError, errorText } from "../../lib/api";
import { useSession } from "../../lib/session";
import { AuthLayout, PasswordField } from "./AuthLayout";
import { t } from "../../lib/i18n";
import { rich } from "../../lib/i18n-rich";

export default function Signup() {
  const { signIn } = useSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const captchaRef = useRef<TurnstileHandle>(null);
  const short = password.length > 0 && password.length < 16;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 16) return;
    setBusy(true);
    setError(null);
    try {
      await api("/auth/signup", { body: { email, password, turnstile_token: captcha }, auth: false });
      // Signup does not sign in by design; do it straight away so the next
      // screen is onboarding, not a second form. A Turnstile token can only
      // be redeemed once, so the widget solves again (usually invisibly)
      // for this second request rather than reusing the signup token.
      const loginCaptcha = await captchaRef.current?.getFreshToken().catch(() => null);
      try {
        const tokens = await api<{ access_token: string; expires_in: number; csrf_token?: string }>("/auth/login", {
          body: { email, password, turnstile_token: loginCaptcha },
          auth: false,
        });
        await signIn(tokens);
        navigate("/welcome", { replace: true });
      } catch (err) {
        // Production requires a verified address before the first sign-in,
        // so the account exists (signup above succeeded) but this second
        // call is expected to fail here - not an error, just a fork in the
        // flow. Anything else re-throws to the outer catch.
        if (err instanceof ApiError && err.status === 403) navigate(`/verify-email?email=${encodeURIComponent(email)}`, { replace: true });
        else throw err;
      }
    } catch (err) {
      setError(errorText(err));
      captchaRef.current?.getFreshToken().then(setCaptcha).catch(() => setCaptcha(null));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title={t("auth.signup.title")}
      subtitle={t("auth.signup.subtitle")}
      footer={rich("auth.signup.haveAccount", {
        signin: (text) => (
          <Link to="/login" className="font-semibold text-accent-text">
            {text}
          </Link>
        ),
      })}
    >
      <form onSubmit={submit} className="space-y-5">
        <Field label={t("common.email")} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        <PasswordField
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          error={short ? t("auth.signup.more", { count: 16 - password.length }) : null}
          hint={t("auth.signup.hint")}
        />
        <Turnstile ref={captchaRef} onToken={setCaptcha} />
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn-primary w-full" disabled={busy || password.length < 16}>
          {busy ? t("auth.signup.busy") : t("auth.signup.submit")}
        </button>
        <p className="text-center text-sm text-dim">
          {rich("auth.signup.agree", {
            terms: (text) => (
              <a className="underline" href="https://www.pacestreak.com/terms" target="_blank" rel="noopener">
                {text}
              </a>
            ),
            privacy: (text) => (
              <a className="underline" href="https://www.pacestreak.com/privacy" target="_blank" rel="noopener">
                {text}
              </a>
            ),
          })}
        </p>
      </form>
    </AuthLayout>
  );
}
