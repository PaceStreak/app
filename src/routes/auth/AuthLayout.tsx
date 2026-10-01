import { Logo } from "../../components/Logo";
import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { Check, Eye, EyeSlash } from "../../components/phosphor";
import { t } from "../../lib/i18n";

const POINTS = [t("auth.panel.p1"), t("auth.panel.p2"), t("auth.panel.p3")];

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children?: ReactNode; footer?: ReactNode }) {
  return (
    <div className="min-h-[100dvh] lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <main className="safe-top mx-auto flex min-h-[100dvh] w-full max-w-[440px] flex-col px-5 pb-10 lg:max-w-[480px] lg:justify-center lg:px-0">
        <Link to="/" className="mt-10 mb-10 flex items-center gap-2.5 text-[1.05rem] font-semibold tracking-tight lg:mt-0">
          <Logo className="size-8" />
          PaceStreak
        </Link>
        <div className="page-enter">
          <h1 className="text-[2rem] leading-[1.1] font-semibold tracking-[-0.03em] text-balance">{title}</h1>
          {subtitle && <p className="mt-3 text-muted">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
        {footer && <div className="mt-auto pt-10 text-center text-[0.95rem] text-muted lg:mt-8 lg:pt-0">{footer}</div>}
      </main>

      <aside className="auth-panel hidden lg:flex" aria-hidden>
        <div className="max-w-[30rem]">
          <p className="text-[clamp(2.4rem,4vw,3.6rem)] leading-[1] font-extrabold tracking-[-0.04em]">
            {t("auth.panel.line1")}
            <br />
            {t("auth.panel.line2")} <span className="text-accent-text">{t("auth.panel.word")}</span>
            <span className="text-flame">.</span>
          </p>
          <ul className="mt-8 space-y-4">
            {POINTS.map((p) => (
              <li key={p} className="flex gap-3 text-[1.02rem] text-muted">
                <Check size={20} weight="bold" className="mt-0.5 shrink-0 text-accent-text" />
                {p}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}

export function PasswordField({
  value,
  onChange,
  label = t("common.password"),
  autoComplete,
  error,
  hint,
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  autoComplete: string;
  error?: string | null;
  hint?: ReactNode;
}) {
  const [visible, setVisible] = useState(false);
  const id = `pw-${autoComplete}`;
  return (
    <div>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          className="input pr-12"
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          required
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-dim"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t("common.hidePassword") : t("common.showPassword")}
          aria-pressed={visible}
          tabIndex={-1}
        >
          {visible ? <EyeSlash size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
        </button>
      </div>
      {error ? <p className="field-error" role="alert">{error}</p> : hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );
}
