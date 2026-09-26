import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CheckCircle, Info, Warning, X } from "@phosphor-icons/react";

/**
 * Toasts, after Sonner's rules: call toast() from anywhere, one <Toaster />
 * in the tree, entries use transitions rather than keyframes so a burst of
 * toasts retargets smoothly, timers pause while the tab is hidden or the
 * pointer is over the stack, and a swipe dismisses.
 */

export type ToastKind = "success" | "info" | "error" | "celebrate";
export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  body?: string;
  action?: { label: string; onClick: () => void };
  icon?: React.ReactNode;
  duration: number;
}

let toasts: Toast[] = [];
let seq = 0;
const subs = new Set<() => void>();
const emit = () => subs.forEach((s) => s());

export function toast(title: string, opts: Partial<Omit<Toast, "id" | "title">> = {}) {
  const t: Toast = { id: ++seq, kind: opts.kind ?? "info", title, duration: opts.duration ?? 4000, ...opts };
  toasts = [...toasts.slice(-3), t];
  emit();
  return t.id;
}
toast.success = (title: string, opts: Partial<Omit<Toast, "id" | "title">> = {}) => toast(title, { ...opts, kind: "success" });
toast.error = (title: string, opts: Partial<Omit<Toast, "id" | "title">> = {}) => toast(title, { ...opts, kind: "error", duration: 6000 });
toast.celebrate = (title: string, opts: Partial<Omit<Toast, "id" | "title">> = {}) =>
  toast(title, { ...opts, kind: "celebrate", duration: 5500 });

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

function useToasts() {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => toasts,
  );
}

export function Toaster() {
  const items = useToasts();
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const vis = () => setPaused(document.visibilityState !== "visible");
    document.addEventListener("visibilitychange", vis);
    return () => document.removeEventListener("visibilitychange", vis);
  }, []);
  return (
    <section
      aria-label="Notifications"
      aria-live="polite"
      className="toaster"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
    >
      {items.map((t, i) => (
        <ToastItem key={t.id} toast={t} paused={paused} depth={items.length - 1 - i} />
      ))}
    </section>
  );
}

function ToastItem({ toast: t, paused, depth }: { toast: Toast; paused: boolean; depth: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const remaining = useRef(t.duration);
  const started = useRef(Date.now());
  const drag = useRef<{ x: number; t: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (paused) {
      remaining.current -= Date.now() - started.current;
      return;
    }
    started.current = Date.now();
    const timer = setTimeout(() => dismissToast(t.id), Math.max(800, remaining.current));
    return () => clearTimeout(timer);
  }, [paused, t.id]);

  const Icon =
    t.kind === "success" ? CheckCircle : t.kind === "error" ? Warning : t.kind === "celebrate" ? null : Info;

  return (
    <div
      ref={ref}
      role={t.kind === "error" ? "alert" : "status"}
      className="toast"
      data-kind={t.kind}
      data-mounted={mounted}
      data-depth={Math.min(depth, 3)}
      onPointerDown={(e) => {
        // Capturing the pointer would retarget the click away from a button.
        if ((e.target as HTMLElement).closest("button")) return;
        drag.current = { x: e.clientX, t: performance.now() };
        ref.current?.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!drag.current || !ref.current) return;
        const dx = e.clientX - drag.current.x;
        ref.current.style.transition = "none";
        ref.current.style.transform = `translateX(${dx}px)`;
        ref.current.style.opacity = String(1 - Math.min(Math.abs(dx) / 240, 0.8));
      }}
      onPointerUp={(e) => {
        const d = drag.current;
        drag.current = null;
        if (!d || !ref.current) return;
        const dx = e.clientX - d.x;
        const v = Math.abs(dx) / (performance.now() - d.t);
        ref.current.style.transition = "";
        ref.current.style.opacity = "";
        if (Math.abs(dx) > 90 || v > 0.11) {
          ref.current.style.transform = `translateX(${dx > 0 ? 120 : -120}%)`;
          setTimeout(() => dismissToast(t.id), 180);
        } else {
          ref.current.style.transform = "";
        }
      }}
    >
      <div className="toast-icon">{t.icon ?? (Icon ? <Icon size={20} weight="fill" /> : null)}</div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold leading-snug">{t.title}</p>
        {t.body && <p className="mt-0.5 text-sm leading-snug text-muted">{t.body}</p>}
      </div>
      {t.action && (
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          onClick={() => {
            t.action!.onClick();
            dismissToast(t.id);
          }}
        >
          {t.action.label}
        </button>
      )}
      <button type="button" aria-label="Dismiss" className="toast-close" onClick={() => dismissToast(t.id)}>
        <X size={14} />
      </button>
    </div>
  );
}
