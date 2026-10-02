import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { NetworkError, api, clearSession, hasSession, refresh, setTokens } from "./api";
import { kvGet, kvSet, unpark, wipe } from "./db";
import { queryClient, warmOfflineCache } from "./queries";
import { push, schedulePush, startSync } from "./sync";
import type { Me } from "./types";

type Status = "loading" | "anon" | "ready";

interface SessionValue {
  status: Status;
  me: Me | null;
  /** True when we are running on cached data because the API is unreachable. */
  offline: boolean;
  reloadMe: () => Promise<Me | null>;
  signIn: (tokens: { access_token: string; expires_in: number; csrf_token?: string | null }) => Promise<Me | null>;
  signOut: (everywhere?: boolean) => Promise<void>;
  setMe: (me: Me) => void;
}

const Ctx = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [me, setMeState] = useState<Me | null>(null);
  const [offline, setOffline] = useState(false);

  const setMe = useCallback((value: Me) => {
    setMeState(value);
    void kvSet("me", value);
  }, []);

  const loadMe = useCallback(async (): Promise<Me | null> => {
    const fresh = await api<Me>("/me");
    const cached = await kvGet<Me>("me");
    // Another person signed in on this device: their data must not mingle.
    // The previous person's unsent writes are parked, not deleted.
    if (cached && cached.user.id !== fresh.user.id) {
      await wipe(cached.user.id);
      queryClient.clear();
    }
    // Anything this person left unsent when they last signed out comes back.
    try {
      if ((await unpark(fresh.user.id)) > 0) schedulePush(0);
    } catch {
      /* storage unavailable; nothing to restore */
    }
    setMe(fresh);
    setOffline(false);
    void warmOfflineCache();
    return fresh;
  }, [setMe]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!hasSession()) {
        setStatus("anon");
        return;
      }
      try {
        const ok = await refresh();
        if (!ok) {
          if (!cancelled) setStatus("anon");
          return;
        }
        await loadMe();
        if (!cancelled) setStatus("ready");
        startSync();
      } catch (err) {
        const cached = await kvGet<Me>("me");
        if (err instanceof NetworkError && cached) {
          // Offline start: run on the last known profile; the outbox will
          // flush once a refresh succeeds.
          setMeState(cached);
          setOffline(true);
          setStatus("ready");
          const retry = async () => {
            try {
              if (await refresh()) {
                await loadMe();
                startSync();
                window.removeEventListener("online", retry);
              }
            } catch {
              /* still offline */
            }
          };
          window.addEventListener("online", retry);
        } else if (!cancelled) {
          setStatus("anon");
        }
      }
    })();
    const onSignedOut = () => {
      setMeState(null);
      setStatus("anon");
    };
    window.addEventListener("ps:signed-out", onSignedOut);
    return () => {
      cancelled = true;
      window.removeEventListener("ps:signed-out", onSignedOut);
    };
  }, [loadMe]);

  const signIn = useCallback<SessionValue["signIn"]>(
    async (tokens) => {
      setTokens(tokens);
      const value = await loadMe();
      setStatus("ready");
      startSync();
      return value;
    },
    [loadMe],
  );

  const signOut = useCallback(async (everywhere = false) => {
    // Last chance to send anything still queued while the session is valid.
    try {
      await push();
    } catch {
      /* offline: what's left is parked below */
    }
    try {
      if (everywhere) await api("/auth/logout-all", { method: "POST" });
      else await api("/auth/logout", { method: "POST", csrf: true, auth: false });
    } catch {
      /* sign out locally regardless */
    }
    clearSession();
    // Unsent writes are parked under this person, never thrown away.
    await wipe((await kvGet<Me>("me"))?.user.id);
    queryClient.clear();
    setMeState(null);
    setStatus("anon");
  }, []);

  const reloadMe = useCallback(async () => {
    try {
      return await loadMe();
    } catch {
      return null;
    }
  }, [loadMe]);

  const value = useMemo(
    () => ({ status, me, offline, reloadMe, signIn, signOut, setMe }),
    [status, me, offline, reloadMe, signIn, signOut, setMe],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const value = useContext(Ctx);
  if (!value) throw new Error("useSession outside SessionProvider");
  return value;
}

/** The signed-in person. Only call inside the authenticated shell. */
export function useMe(): Me {
  const { me } = useSession();
  if (!me) throw new Error("useMe without a session");
  return me;
}
