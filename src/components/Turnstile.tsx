import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

/**
 * Cloudflare Turnstile: proves a form submission isn't a script, before it
 * reaches an endpoint that sends email (signup, forgot-password,
 * resend-verification) or checks a password/recovery code (login, recover).
 * See api/app/turnstile.py for why: a free SMTP tier empties its daily quota
 * fast without this.
 *
 * Renders nothing when PUBLIC_TURNSTILE_SITE_KEY is unset, so local
 * development needs no Cloudflare account - the same shape as the API's
 * TURNSTILE_SECRET_KEY, which is unset by default too.
 */

const SITE_KEY = import.meta.env.PUBLIC_TURNSTILE_SITE_KEY as string | undefined;
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      remove: (id: string) => void;
      reset: (id: string) => void;
    };
  }
}

let scriptPromise: Promise<void> | null = null;
function loadScript(): Promise<void> {
  scriptPromise ??= new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${SCRIPT_SRC}"]`)) {
      resolve();
      return;
    }
    const el = document.createElement("script");
    el.src = SCRIPT_SRC;
    el.async = true;
    el.defer = true;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error("Turnstile failed to load"));
    document.head.appendChild(el);
  });
  return scriptPromise;
}

export type TurnstileHandle = {
  /** Resets the widget and resolves with a fresh token once solved - used
   * where one page makes two guarded requests in a row (Signup's immediate
   * auto-login), since a Turnstile token can only be redeemed once. */
  getFreshToken: () => Promise<string>;
};

export const Turnstile = forwardRef<TurnstileHandle, { onToken: (token: string | null) => void }>(
  function Turnstile({ onToken }, ref) {
    const elRef = useRef<HTMLDivElement>(null);
    const widgetId = useRef<string | null>(null);
    const pending = useRef<{ resolve: (t: string) => void; reject: (e: Error) => void } | null>(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
      if (!SITE_KEY) return;
      let cancelled = false;
      void loadScript().then(() => {
        if (!cancelled) setReady(true);
      });
      return () => {
        cancelled = true;
      };
    }, []);

    useEffect(() => {
      if (!ready || !SITE_KEY || !elRef.current || !window.turnstile) return;
      const turnstile = window.turnstile;
      const id = turnstile.render(elRef.current, {
        sitekey: SITE_KEY,
        callback: (token: string) => {
          onToken(token);
          pending.current?.resolve(token);
          pending.current = null;
        },
        "expired-callback": () => onToken(null),
        "error-callback": () => {
          onToken(null);
          pending.current?.reject(new Error("Turnstile error"));
          pending.current = null;
        },
      });
      widgetId.current = id;
      return () => turnstile.remove(id);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready]);

    useImperativeHandle(ref, () => ({
      getFreshToken: () =>
        new Promise<string>((resolve, reject) => {
          const turnstile = window.turnstile;
          if (!turnstile || !widgetId.current) {
            reject(new Error("Turnstile not ready"));
            return;
          }
          pending.current = { resolve, reject };
          turnstile.reset(widgetId.current);
          setTimeout(() => {
            if (pending.current?.resolve === resolve) {
              pending.current = null;
              reject(new Error("Turnstile timed out"));
            }
          }, 10_000);
        }),
    }));

    if (!SITE_KEY) return null;
    return <div ref={elRef} className="flex justify-center" />;
  },
);
