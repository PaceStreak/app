export function Splash() {
  return (
    <div className="grid min-h-[100dvh] place-items-center" role="status" aria-label="Loading PaceStreak">
      <svg viewBox="0 0 64 64" className="splash-bolt size-12" aria-hidden>
        <path d="M37 10 14 36h14l-2 18 24-26H36l1-18Z" fill="var(--accent)" />
      </svg>
    </div>
  );
}
