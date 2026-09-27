/** The mark: the lime bolt, drawn on the product's own dark ground. */
export function Logo({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <path d="M39 5 8 39h19L25 59 56 25H37L39 5Z" fill="var(--accent-text)" />
    </svg>
  );
}
