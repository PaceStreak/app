import { useEffect, useRef, type ReactNode } from "react";
import { X } from "@phosphor-icons/react";

/**
 * Bottom sheet on phones, centred panel on wide screens.
 *
 * Built on <dialog>.showModal(): the browser supplies the focus trap, the
 * inert background, Escape, and top-layer stacking, so none of it is
 * reimplemented here. Motion is a CSS transition with the iOS drawer curve;
 * the handle drags to dismiss, and a quick flick counts even when short.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg" | "full";
  dismissible?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; t: number; dy: number } | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      dialog.dataset.state = "open";
    } else if (!open && dialog.open) {
      // Leave the modal state immediately: a modal dialog keeps the rest of
      // the page inert, and input landing during the exit animation would be
      // silently dropped (found by the e2e run: a weight typed straight after
      // picking an exercise vanished). Reopen non-modal just to animate out.
      dialog.close();
      dialog.show();
      dialog.dataset.state = "closing";
      const done = () => {
        dialog.close();
        dialog.dataset.state = "";
      };
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) done();
      else setTimeout(done, 220);
    }
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const cancel = (e: Event) => {
      e.preventDefault();
      if (dismissible) closeRef.current();
    };
    dialog.addEventListener("cancel", cancel);
    return () => dialog.removeEventListener("cancel", cancel);
  }, [dismissible]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!dismissible || drag.current) return;
    drag.current = { y: e.clientY, t: performance.now(), dy: 0 };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current || !panel.current) return;
    const dy = e.clientY - drag.current.y;
    drag.current.dy = dy;
    // Downward follows the finger; upward gets heavy friction, not a wall.
    const offset = dy > 0 ? dy : -Math.sqrt(-dy) * 2;
    panel.current.style.transition = "none";
    panel.current.style.transform = `translateY(${offset}px)`;
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || !panel.current) return;
    panel.current.style.transition = "";
    panel.current.style.transform = "";
    const velocity = d.dy / (performance.now() - d.t);
    if (d.dy > 120 || velocity > 0.11) closeRef.current();
  };

  const width = size === "lg" ? "sm:max-w-2xl" : size === "full" ? "sm:max-w-3xl" : "sm:max-w-lg";

  return (
    <dialog
      ref={ref}
      className="sheet"
      onClick={(e) => {
        if (e.target === ref.current && dismissible) onClose();
      }}
    >
      <div ref={panel} className={`sheet-panel ${width} ${size === "full" ? "sheet-full" : ""}`}>
        <div
          className="sheet-handle"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <span />
        </div>
        {(title || dismissible) && (
          <header className="flex items-center justify-between gap-3 px-5 pb-2">
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            {dismissible && (
              <button type="button" className="btn btn-ghost btn-icon -mr-2" onClick={onClose} aria-label="Close">
                <X size={20} />
              </button>
            )}
          </header>
        )}
        <div className="sheet-body">{children}</div>
        {footer && <footer className="sheet-footer">{footer}</footer>}
      </div>
    </dialog>
  );
}
