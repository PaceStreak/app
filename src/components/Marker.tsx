/**
 * Felt-tip marks drawn over a calendar box: an X for a day done, a single
 * stroke for a day part-done, a ring for a slip. Each stroke draws itself in
 * when it first appears (the page's one authored motion); with reduced
 * motion it is simply there. Slightly uneven on purpose: a hand did this.
 */
export function MarkerX({ className = "", tone = "var(--accent)" }: { className?: string; tone?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={`marker ${className}`} aria-hidden style={{ color: tone }}>
      <path className="marker-stroke" pathLength={1} d="M8.5 9.5c6.5 5.4 15 13.2 23 21.8" />
      <path className="marker-stroke marker-stroke-2" pathLength={1} d="M31.5 8.8C24 15 16.4 22.3 8.8 31" />
    </svg>
  );
}

export function MarkerSlash({ className = "", tone = "var(--accent)" }: { className?: string; tone?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={`marker ${className}`} aria-hidden style={{ color: tone }}>
      <path className="marker-stroke" pathLength={1} d="M30.5 9.5C23.5 16 16.5 23 9.5 30.5" />
    </svg>
  );
}

export function MarkerRing({ className = "", tone = "var(--flame)" }: { className?: string; tone?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={`marker ${className}`} aria-hidden style={{ color: tone }}>
      <path className="marker-stroke" pathLength={1} d="M21 6.5c-8.3-.6-14.6 5.6-14.4 13.6.2 7.6 6.3 13.3 13.9 13.1 7.9-.2 13.3-6.4 13-13.8C33.2 12 27.8 6.6 19.6 7.2" />
    </svg>
  );
}

/** A printed tick box, crossed off in marker when done. The checklist mark
 * everywhere, so there is only one way "done" looks in the product. */
export function TickBox({ done, size = 20, label }: { done: boolean; size?: number; label?: string }) {
  return (
    <span
      className="relative inline-block shrink-0 rounded-[5px] border-[1.5px] border-line-lit bg-surface-2"
      style={{ width: size, height: size }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {done && <MarkerX />}
    </span>
  );
}
