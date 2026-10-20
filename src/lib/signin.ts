/**
 * The second step of a password sign-in (api `/v1/auth/login` -> `/v1/auth/2fa/verify`).
 *
 * `method: "totp"` asks for an authenticator code; `"email"` for the six-digit code the API just mailed. Either
 * takes a recovery code instead. A 503 from login means the code email could not be sent: its body still carries
 * the challenge, so the person can finish with a recovery code (nobody gets in without one).
 */
import { ApiError } from "./api";

export interface Challenge {
  mfa_required: true;
  mfa_token: string;
  expires_in: number;
  /** Older servers sent no method: those challenges were always TOTP. */
  method?: "totp" | "email";
  resend_in?: number;
  email_sent?: boolean;
}

export function isChallenge(v: unknown): v is Challenge {
  return typeof v === "object" && v !== null && (v as { mfa_required?: unknown }).mfa_required === true && typeof (v as { mfa_token?: unknown }).mfa_token === "string";
}

/** The challenge a failed login still carries (the 503 "couldn't send your code"), if any. */
export function challengeFromError(err: unknown): Challenge | null {
  return err instanceof ApiError && err.status === 503 && isChallenge(err.data) ? err.data : null;
}

/** Seconds to wait before another code, from a 429 resend answer, else null. */
export function resendWait(err: unknown): number | null {
  if (!(err instanceof ApiError) || err.status !== 429) return null;
  const s = (err.data as { resend_in?: unknown } | undefined)?.resend_in;
  return typeof s === "number" && s > 0 ? Math.ceil(s) : null;
}

/** Six digits, spaces allowed: the emailed or authenticator code. Anything else is tried as a recovery code. */
export const isSixDigits = (code: string) => /^\d{6}$/.test(code.replace(/\s/g, ""));

/** What the verify call sends: digits without spaces; recovery codes as typed, upper-cased. */
export const normaliseCode = (code: string) => (isSixDigits(code) ? code.replace(/\s/g, "") : code.trim().toUpperCase());

/** "0:42" for a resend countdown. */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
