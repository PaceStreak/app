/** The mark: a wall-calendar page crossed off in red marker. */
export function Logo({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect x="6" y="9" width="52" height="49" rx="5" fill="var(--surface)" stroke="var(--ink)" strokeWidth="3" />
      <path d="M6 14a5 5 0 0 1 5-5h42a5 5 0 0 1 5 5v7H6z" fill="var(--accent)" stroke="var(--ink)" strokeWidth="3" strokeLinejoin="round" />
      <path d="M21 5v9M43 5v9" stroke="var(--ink)" strokeWidth="4" strokeLinecap="round" />
      <path d="M19.5 29.5c8 6 16 13.5 25 21.5M45 29c-9.5 7-17 14-25 21.5" fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}
