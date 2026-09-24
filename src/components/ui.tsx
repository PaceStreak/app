import { forwardRef, useId, type ReactNode } from "react";
import { Link } from "react-router";
import { ArrowLeft, CaretRight, CloudSlash } from "./phosphor";

export function Avatar({
  name,
  hue,
  size = 40,
  className = "",
}: {
  name: string | null | undefined;
  hue: number;
  size?: number;
  className?: string;
}) {
  const initials =
    (name ?? "?")
      .replace(/^@/, "")
      .split(/[\s_.-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?";
  return (
    <span
      aria-hidden
      className={`avatar hue-${Math.round(hue / 30) % 12} ${className}`}
      data-size={size >= 64 ? "xl" : size >= 48 ? "lg" : size <= 28 ? "sm" : "md"}
    >
      {initials}
    </span>
  );
}

export function PageHeader({
  title,
  back,
  action,
  subtitle,
}: {
  title: ReactNode;
  back?: string | boolean;
  action?: ReactNode;
  subtitle?: ReactNode;
}) {
  return (
    <header className="flex items-start gap-2 pt-4 pb-4">
      {back && (
        <Link
          to={typeof back === "string" ? back : ".."}
          onClick={(e) => {
            if (back === true && window.history.length > 1) {
              e.preventDefault();
              window.history.back();
            }
          }}
          className="btn btn-ghost btn-icon -ml-3 shrink-0"
          aria-label="Back"
        >
          <ArrowLeft size={22} />
        </Link>
      )}
      <div className="min-w-0 flex-1 pt-1.5">
        <h1 className="text-[1.65rem] leading-tight font-semibold tracking-[-0.02em] text-balance">{title}</h1>
        {subtitle && <p className="mt-1 text-[0.95rem] text-muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0 pt-1">{action}</div>}
    </header>
  );
}

export function Section({
  title,
  action,
  children,
  className = "",
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`mt-8 ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-baseline justify-between gap-3">
          {title && <h2 className="text-[1.05rem] font-semibold tracking-tight">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function RowLink({
  to,
  icon,
  title,
  detail,
  onClick,
}: {
  to?: string;
  icon?: ReactNode;
  title: ReactNode;
  detail?: ReactNode;
  onClick?: () => void;
}) {
  const inner = (
    <>
      {icon && <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-muted">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{title}</span>
        {detail && <span className="block truncate text-sm text-dim">{detail}</span>}
      </span>
      <CaretRight size={16} className="shrink-0 text-dim" />
    </>
  );
  const cls = "press flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2/60";
  return to ? (
    <Link to={to} className={cls}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

export function List({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`card divide-y divide-line overflow-hidden ${className}`}>{children}</div>;
}

export function Empty({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {icon && <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-surface-2 text-dim">{icon}</div>}
      <p className="font-semibold">{title}</p>
      {body && <p className="mt-1.5 max-w-[34ch] text-[0.95rem] text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  return (
    <Empty
      icon={<CloudSlash size={26} />}
      title={offline ? "You're offline" : "Couldn't load this"}
      body={offline ? "This needs a connection. Your logging still works offline." : (error as Error)?.message}
      action={
        onRetry && (
          <button type="button" className="btn btn-secondary" onClick={onRetry}>
            Try again
          </button>
        )
      }
    />
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

export function Loading({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-20" />
      ))}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-4 px-4 py-3.5 text-left disabled:opacity-50"
    >
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{label}</span>
        {description && <span className="mt-0.5 block text-sm text-dim">{description}</span>}
      </span>
      <span className="switch" data-on={checked} aria-hidden />
    </button>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: ReactNode;
  error?: string | null;
  hint?: ReactNode;
  trailing?: ReactNode;
};

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, error, hint, trailing, id, className = "", ...props },
  ref,
) {
  const auto = useId();
  const fid = id ?? auto;
  const describedBy = error ? `${fid}-err` : hint ? `${fid}-hint` : undefined;
  return (
    <div className={className}>
      <label className="field-label" htmlFor={fid}>
        {label}
      </label>
      <div className="relative">
        <input
          ref={ref}
          id={fid}
          className={`input ${trailing ? "pr-14" : ""}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...props}
        />
        {trailing && <span className="absolute inset-y-0 right-3 flex items-center text-sm text-dim">{trailing}</span>}
      </div>
      {error ? (
        <p id={`${fid}-err`} className="field-error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${fid}-hint`} className="field-hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

export function Banner({
  tone = "info",
  icon,
  children,
  action,
}: {
  tone?: "info" | "flame" | "danger" | "accent";
  icon?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
}) {
  const tones = {
    info: "bg-surface-2 text-ink",
    flame: "bg-flame-soft text-ink",
    danger: "bg-danger-soft text-ink",
    accent: "bg-accent-soft text-ink",
  } as const;
  return (
    <div className={`flex items-start gap-3 rounded-2xl px-4 py-3 ${tones[tone]}`}>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0 flex-1 text-[0.95rem]">{children}</div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div>
      <p className="text-sm text-dim">{label}</p>
      <p className="num mt-0.5 text-2xl font-semibold tracking-tight">{value}</p>
      {sub && <p className="text-sm text-muted">{sub}</p>}
    </div>
  );
}
