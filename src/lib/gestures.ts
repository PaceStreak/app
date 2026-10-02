import { useRef, useState } from "react";

const SWIPE = 72; // px to commit a swipe
const HOLD_MS = 500;
const SLOP = 8; // px of movement that still counts as holding still

/**
 * Horizontal swipe and long-press on a row, with pointer events so it works
 * for touch, pen and mouse alike. Vertical scrolling is left to the browser
 * (pair with `touch-action: pan-y`), and a gesture only starts once movement
 * is clearly sideways, so scrolling a list never ticks anything. These are
 * shortcuts: every action stays reachable by its button.
 */
export function useRowGestures(opts: { onSwipeRight?: () => void; onSwipeLeft?: () => void; onLongPress?: () => void; disabled?: boolean }) {
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number; id: number; horizontal: boolean | null } | null>(null);
  const hold = useRef<number | undefined>(undefined);
  const fired = useRef(false);

  const clearHold = () => window.clearTimeout(hold.current);
  const reset = () => {
    clearHold();
    start.current = null;
    setDx(0);
  };

  const handlers = {
    onPointerDown: (e: React.PointerEvent) => {
      if (opts.disabled || (e.pointerType === "mouse" && e.button !== 0)) return;
      if ((e.target as HTMLElement).closest("button, a, input")) return;
      start.current = { x: e.clientX, y: e.clientY, id: e.pointerId, horizontal: null };
      fired.current = false;
      if (opts.onLongPress) {
        hold.current = window.setTimeout(() => {
          fired.current = true;
          start.current = null;
          navigator.vibrate?.(12);
          opts.onLongPress?.();
        }, HOLD_MS);
      }
    },
    onPointerMove: (e: React.PointerEvent) => {
      const s = start.current;
      if (!s || s.id !== e.pointerId) return;
      const x = e.clientX - s.x;
      const y = e.clientY - s.y;
      if (Math.abs(x) > SLOP || Math.abs(y) > SLOP) clearHold();
      if (s.horizontal === null && (Math.abs(x) > SLOP || Math.abs(y) > SLOP)) {
        s.horizontal = Math.abs(x) > Math.abs(y) * 1.5;
        if (s.horizontal) (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      }
      if (s.horizontal) {
        const allowed = (x > 0 && opts.onSwipeRight) || (x < 0 && opts.onSwipeLeft);
        // Resist past the threshold, so the row feels anchored.
        setDx(allowed ? Math.sign(x) * Math.min(Math.abs(x), SWIPE + (Math.abs(x) - SWIPE) * 0.25) : 0);
      }
    },
    onPointerUp: () => {
      const committed = Math.abs(dx) >= SWIPE;
      const direction = dx;
      reset();
      if (committed && !fired.current) {
        navigator.vibrate?.(10);
        if (direction > 0) opts.onSwipeRight?.();
        else opts.onSwipeLeft?.();
      }
    },
    onPointerCancel: reset,
    onContextMenu: (e: React.MouseEvent) => {
      // A long-press on touch would otherwise open the browser's menu.
      if (opts.onLongPress && fired.current) e.preventDefault();
    },
  };

  return { dx, armed: Math.abs(dx) >= SWIPE ? (dx > 0 ? "right" : "left") : null, handlers };
}
