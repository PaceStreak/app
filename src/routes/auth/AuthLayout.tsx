import { Logo } from "../../components/Logo";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { t } from "../../lib/i18n";

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children?: ReactNode; footer?: ReactNode }) {
  return (
    <main className="safe-top mx-auto flex min-h-[100dvh] w-full max-w-[420px] flex-col px-5 pb-10">
      <Link to="/" className="mt-10 mb-10 flex items-center gap-2.5 text-[1.05rem] font-semibold tracking-tight">
        <Logo className="size-8" />
        PaceStreak
      </Link>
      <div className="page-enter">
        <h1 className="text-[2rem] leading-[1.1] font-semibold tracking-[-0.03em] text-balance">{title}</h1>
        {subtitle && <p className="mt-3 text-muted">{subtitle}</p>}
        <div className="mt-8">{children}</div>
      </div>
      {footer && <div className="mt-auto pt-10 text-center text-[0.95rem] text-muted">{footer}</div>}
    </main>
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
  return (
    <div>
      <label className="field-label" htmlFor={`pw-${autoComplete}`}>
        {label}
      </label>
      <input
        id={`pw-${autoComplete}`}
        className="input"
        type="password"
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        required
      />
      {error ? <p className="field-error" role="alert">{error}</p> : hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );
}
