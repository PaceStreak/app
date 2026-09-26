/**
 * The only way this app talks to api.pacestreak.com.
 *
 * Auth model (see api/app/auth/router.py):
 * - The access token lives in memory only. It is never written to storage,
 *   so an XSS bug cannot lift a long-lived credential from localStorage.
 * - The refresh token is an httpOnly cookie on the API's /v1/auth path; this
 *   code never sees it.
 * - The CSRF token is returned in the login/refresh body (the cookie copy is
 *   unreadable from this origin) and is kept in localStorage so a reload can
 *   refresh. It is useless without the cookie, which is the point of it.
 */

import { t } from "./i18n";

export const API_BASE =
  import.meta.env.PUBLIC_API_BASE_URL ??
  (import.meta.env.PROD ? "https://api.pacestreak.com" : "http://localhost:8000");

const CSRF_KEY = "ps.csrf";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown,
  ) {
    super(message);
  }
}

/** The request never reached the server: offline, DNS, CORS, timeout. */
export class NetworkError extends Error {
  constructor() {
    super(t("errors.offline"));
  }
}

type Tokens = { access_token: string; expires_in: number; csrf_token?: string | null };

let accessToken: string | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
let refreshing: Promise<boolean> | null = null;

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function hasSession(): boolean {
  return Boolean(storage()?.getItem(CSRF_KEY));
}

export function setTokens(tokens: Tokens) {
  accessToken = tokens.access_token;
  if (tokens.csrf_token) storage()?.setItem(CSRF_KEY, tokens.csrf_token);
  clearTimeout(refreshTimer);
  // Refresh a minute early so a request never races an expiring token.
  const ms = Math.max(30, tokens.expires_in - 60) * 1000;
  refreshTimer = setTimeout(() => void refresh(), ms);
}

export function clearSession() {
  accessToken = null;
  clearTimeout(refreshTimer);
  storage()?.removeItem(CSRF_KEY);
}

export function isAuthenticated() {
  return accessToken !== null;
}

/** Rotate the refresh cookie for a new access token. Concurrent callers share
 * one request - two parallel rotations would trip the API's reuse detection
 * and burn the whole session. */
export function refresh(): Promise<boolean> {
  if (refreshing) return refreshing;
  const csrf = storage()?.getItem(CSRF_KEY);
  if (!csrf) return Promise.resolve(false);
  refreshing = (async () => {
    try {
      const res = await fetch(`${API_BASE}/v1/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "X-CSRF-Token": csrf },
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          clearSession();
          window.dispatchEvent(new Event("ps:signed-out"));
        }
        return false;
      }
      setTokens(await res.json());
      return true;
    } catch {
      throw new NetworkError();
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

function message(status: number, data: unknown): string {
  const detail = (data as { detail?: unknown })?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length) {
    // FastAPI validation errors: [{loc, msg}]. Show the first, readably.
    const first = detail[0] as { loc?: string[]; msg?: string };
    const field = first.loc?.filter((p) => p !== "body").join(" ");
    const msg = (first.msg ?? "is invalid").replace(/^Value error, /, "");
    return field ? `${field}: ${msg}` : msg;
  }
  if (status === 429) return t("errors.tooMany");
  if (status >= 500) return t("errors.server");
  return t("errors.generic");
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  form?: FormData;
  /** Raw bytes, sent with the blob's own type (a photo upload). */
  blob?: Blob;
  auth?: boolean;
  csrf?: boolean;
  raw?: boolean;
  signal?: AbortSignal;
}

export async function api<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = opts.body || opts.form || opts.blob ? "POST" : "GET", auth = true } = opts;
  const send = async () => {
    const headers: Record<string, string> = {};
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";
    if (opts.blob) headers["Content-Type"] = opts.blob.type;
    if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;
    if (opts.csrf) {
      const csrf = storage()?.getItem(CSRF_KEY);
      if (csrf) headers["X-CSRF-Token"] = csrf;
    }
    try {
      return await fetch(`${API_BASE}/v1${path}`, {
        method,
        headers,
        credentials: "include",
        body: opts.blob ?? opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
        signal: opts.signal,
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") throw err;
      throw new NetworkError();
    }
  };

  if (auth && !accessToken && hasSession()) await refresh();
  let res = await send();
  if (res.status === 401 && auth && hasSession()) {
    if (await refresh()) res = await send();
  }
  if (opts.raw) {
    if (!res.ok) throw new ApiError(res.status, message(res.status, await res.json().catch(() => null)));
    return res as T;
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, message(res.status, data), data);
  return data as T;
}

export const get = <T,>(path: string) => api<T>(path);
export const post = <T,>(path: string, body?: unknown) => api<T>(path, { method: "POST", body: body ?? {} });
export const put = <T,>(path: string, body?: unknown) => api<T>(path, { method: "PUT", body: body ?? {} });
export const patch = <T,>(path: string, body?: unknown) => api<T>(path, { method: "PATCH", body: body ?? {} });
export const del = <T,>(path: string) => api<T>(path, { method: "DELETE" });

export function errorText(err: unknown): string {
  if (err instanceof ApiError || err instanceof NetworkError) return err.message;
  return t("errors.unknown");
}
