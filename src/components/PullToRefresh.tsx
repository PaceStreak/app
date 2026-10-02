import { useEffect, useRef, useState } from "react";
import { ArrowClockwise } from "./phosphor";
import { queryClient } from "../lib/queries";
import { syncNow } from "../lib/sync";

const THRESHOLD = 72;
const MAX = 110;

const standalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

/**
 * Pull down at the top of a page to sync and refresh. Only in the installed
 * app: in a browser tab the browser's own pull-to-refresh already exists,
 * and two would fight. Refreshes data in place rather than reloading, so an
 * open sheet or a half-typed note survives.
 */
export function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const start = useRef<number | null>(null);
  // Read by the touch handlers, which are attached once.
  const pullRef = useRef(0);
  const busyRef = useRef(false);
  const show = (v: number) => {
    pullRef.current = v;
    setPull(v);
  };

  useEffect(() => {
    if (!standalone()) return;
    const onStart = (e: TouchEvent) => {
      if (busyRef.current || window.scrollY > 0 || document.querySelector("dialog[open]") || e.touches.length !== 1) return;
      start.current = e.touches[0].clientY;
    };
    const onMove = (e: TouchEvent) => {
      if (start.current == null) return;
      const dy = e.touches[0].clientY - start.current;
      if (dy <= 0 || window.scrollY > 0) {
        show(0);
        return;
      }
      // Ease out: the further you pull, the less it moves.
      show(Math.min(MAX, dy * 0.5));
    };
    const onEnd = async () => {
      if (start.current == null) return;
      start.current = null;
      const go = pullRef.current >= THRESHOLD;
      show(0);
      if (!go) return;
      navigator.vibrate?.(10);
      busyRef.current = true;
      setBusy(true);
      try {
        // Push this device's changes first, then refetch what's on screen.
        await syncNow().catch(() => undefined);
        await queryClient.refetchQueries({ type: "active" });
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  if (!pull && !busy) return null;
  const ready = pull >= THRESHOLD;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+3.25rem)] z-40 flex justify-center" role="status" aria-live="polite">
      <span
        className={`grid size-9 place-items-center rounded-full border border-line bg-surface shadow-lg ${busy ? "animate-spin motion-reduce:animate-none" : ""} ${ready || busy ? "text-accent-text" : "text-dim"}`}
        style={{ transform: busy ? undefined : `translateY(${pull - 30}px) rotate(${pull * 3}deg)`, opacity: busy ? 1 : Math.min(1, pull / THRESHOLD) }}
      >
        <ArrowClockwise size={18} weight="bold" />
        <span className="sr-only">{busy ? "Refreshing" : ready ? "Release to refresh" : "Pull to refresh"}</span>
      </span>
    </div>
  );
}
