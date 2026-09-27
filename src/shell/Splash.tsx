import { Logo } from "../components/Logo";
export function Splash() {
  return (
    <div className="grid min-h-[100dvh] place-items-center" role="status" aria-label="Loading PaceStreak">
      <Logo className="splash-bolt size-12" />
    </div>
  );
}
