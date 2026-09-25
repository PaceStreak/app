/**
 * Crash reporting to our own API - no third-party error service.
 *
 * Reports are anonymous (no user id, no token), the URL is cut to its path
 * on the server, and each distinct error is sent at most once per page load,
 * with a hard cap, so a render loop can't flood the endpoint. Failing to
 * report is silent: a broken reporter must never cause a second error.
 */

import { API_BASE } from "./api";

const RELEASE = import.meta.env.VITE_RELEASE ?? "dev";
const MAX_PER_LOAD = 10;
const seen = new Set<string>();

export function reportError(error: unknown, context?: string) {
  try {
    const err = error instanceof Error ? error : new Error(typeof error === "string" ? error : "Non-error thrown");
    const message = `${context ? `${context}: ` : ""}${err.name}: ${err.message}`.slice(0, 2000);
    const key = message + (err.stack?.split("\n")[1] ?? "");
    if (seen.has(key) || seen.size >= MAX_PER_LOAD) return;
    seen.add(key);
    const body = JSON.stringify({ message, stack: err.stack?.slice(0, 20_000) ?? null, url: location.pathname, release: RELEASE });
    // keepalive lets the report survive the page unloading after a crash.
    void fetch(`${API_BASE}/v1/client-errors`, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch {
    /* never throw from the reporter */
  }
}

/** Uncaught errors and promise rejections anywhere in the page. */
export function installErrorReporting() {
  if (import.meta.env.DEV) return;
  window.addEventListener("error", (e) => reportError(e.error ?? e.message, "window"));
  window.addEventListener("unhandledrejection", (e) => {
    // Offline and expected API failures are handled where they happen.
    const r = e.reason as { name?: string } | undefined;
    if (r?.name === "NetworkError" || r?.name === "AbortError") return;
    reportError(e.reason, "unhandled rejection");
  });
}
