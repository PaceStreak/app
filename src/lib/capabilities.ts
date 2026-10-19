/**
 * What this API server can do, for features that come and go with its
 * configuration. Today that is outgoing email (`EMAIL_ENABLED` on the API).
 *
 * Signed in, the flag rides on GET /v1/me, so it costs nothing. Signed out
 * (login, signup, recovery), it comes from the public GET /v1/config, cached
 * here so the next visit renders the right screen at once.
 *
 * Unknown means off: an email screen nobody can complete is worse than a
 * missing one, and production runs without email.
 */
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { useSession } from "./session";
import type { Me } from "./types";

const KEY = "ps:email-enabled";

function remembered(): boolean | undefined {
  try {
    const v = localStorage.getItem(KEY);
    return v === null ? undefined : v === "1";
  } catch {
    return undefined;
  }
}

function remember(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    /* storage unavailable */
  }
}

/** True only when the signed-in person's server says email is on. */
export const emailOn = (me: Pick<Me, "email_enabled"> | null | undefined) => me?.email_enabled === true;

/**
 * Whether email features exist on this server, signed in or not: undefined
 * while that is not known yet (first signed-out visit, session loading).
 */
export function useEmailCapability(): boolean | undefined {
  const { me, status } = useSession();
  const signedIn = status === "ready" && me !== null;
  const config = useQuery({
    queryKey: ["server-config"],
    queryFn: async () => {
      const c = await api<{ email_enabled?: boolean }>("/config", { auth: false });
      const on = c.email_enabled === true;
      remember(on);
      return on;
    },
    enabled: status === "anon",
    staleTime: 5 * 60_000,
    // Placeholder, not initial data: the remembered value renders at once but never stops the fetch.
    placeholderData: remembered,
    retry: 1,
  });
  if (signedIn) return emailOn(me);
  if (status === "loading") return undefined;
  // Unreachable server: fall back to off rather than wait forever.
  if (config.isError) return config.data ?? false;
  return config.data;
}

/** As useEmailCapability, with "not known yet" read as off: for hiding email UI. */
export function useEmailEnabled(): boolean {
  return useEmailCapability() === true;
}
