import { useRef, useState, type FormEvent } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { Turnstile, type TurnstileHandle } from "../../components/Turnstile";
import { Field } from "../../components/ui";
import { api, errorText } from "../../lib/api";
import { useSession } from "../../lib/session";
import { AuthLayout } from "./AuthLayout";
import { t } from "../../lib/i18n";

type Tokens = { access_token: string; expires_in: number; csrf_token?: string };

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { status, reloadMe, signIn } = useSession();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [code, setCode] = useState("");
  const [state, setState] = useState<"working" | "error">("working");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState(false);
  const captchaRef = useRef<TurnstileHandle>(null);
  // Carried from Signup, in memory only via router state - never persisted -
  // so verifying right after signing up can log straight in with no second
  // form. Absent for any other path here (an emailed link, a different tab).
  const password = (location.state as { password?: string } | null)?.password;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/auth/verify-email", { body: { email, code }, auth: false });
      if (status === "ready") {
        // Already signed in on this device (e.g. verifying right after
        // signup) - go straight into the app instead of an extra screen.
        await reloadMe();
        navigate("/", { replace: true });
        return;
      }
      if (password) {
        try {
          const token = await captchaRef.current?.getFreshToken().catch(() => null);
          const tokens = (await api("/auth/login", { body: { email, password, turnstile_token: token }, auth: false })) as Tokens;
          await signIn(tokens);
          navigate("/", { replace: true });
          return;
        } catch {
          // Fall through to the sign-in page below - the account is
          // verified either way, this was just a bonus shortcut.
        }
      }
      // No password in hand and no session to refresh: there's no token to
      // walk in on, so send them to sign in rather than a dead end.
      navigate(`/login?email=${encodeURIComponent(email)}`, { replace: true });
    } catch (err) {
      setState("error");
      setError(errorText(err));
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

  return (
    <AuthLayout
      title={t("auth.verify.title")}
      subtitle={state === "error" ? t("auth.verify.failBody", { error: error ?? "" }) : t("auth.verify.subtitle", { email: email || "your address" })}
    >
      <form onSubmit={submit} className="space-y-5">
        <Field label={t("auth.verify.email")} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus={!email} />
        <Field
          label={t("auth.verify.code")}
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          required
          autoFocus={!!email}
        />
        <button className="btn btn-primary w-full" disabled={busy || code.length !== 6 || !email}>
          {busy ? t("auth.verify.working") : t("auth.verify.submit")}
        </button>
        <Turnstile ref={captchaRef} onToken={() => {}} />
        <button type="button" className="btn btn-secondary w-full" onClick={resend} disabled={busy || !email}>
          {resent ? t("auth.verify.resent") : t("auth.verify.resend")}
        </button>
      </form>
    </AuthLayout>
  );
}
