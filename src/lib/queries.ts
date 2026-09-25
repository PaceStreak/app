import { QueryClient, useQuery, type QueryKey } from "@tanstack/react-query";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ApiError, api } from "./api";
import { allWorkouts, kvGet, kvSet, onWorkoutsChanged } from "./db";
import { subscribeSync, type SyncState } from "./sync";
import type { Exercise, Gear, Library, Routine, Stats, Workout } from "./types";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      networkMode: "offlineFirst",
      refetchOnWindowFocus: true,
      retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
    },
  },
});

// Refresh everything derived from workouts once a sync lands.
if (typeof window !== "undefined") {
  window.addEventListener("ps:synced", () => {
    for (const key of ["stats", "progress", "records", "achievements", "xp", "chains", "feed", "exercise-history", "plan-active", "plan", "gear", "review", "record-history"]) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
  });
}

/**
 * A query whose last good result is kept on the device, so the screen
 * renders immediately (and offline) and then refreshes in place.
 */
export function useCachedQuery<T>(key: QueryKey, path: string, opts: { enabled?: boolean } = {}) {
  const storeKey = `q:${JSON.stringify(key)}`;
  const [seed, setSeed] = useState<T | undefined>(undefined);
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    let alive = true;
    void kvGet<T>(storeKey).then((v) => {
      if (alive) {
        setSeed(v);
        setSeeded(true);
      }
    });
    return () => {
      alive = false;
    };
  }, [storeKey]);
  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      const data = await api<T>(path);
      void kvSet(storeKey, data);
      return data;
    },
    enabled: seeded && opts.enabled !== false,
    placeholderData: seed as never,
  });
  return { ...query, data: query.data ?? seed, seeded };
}

export function useStats() {
  return useCachedQuery<Stats>(["stats"], "/me/stats");
}

export interface LibraryIndex {
  lib: Library;
  exercises: Exercise[];
  byId: Map<string, Exercise>;
  discipline: (id: string) => Library["disciplines"][number] | undefined;
}

export function useLibrary(): LibraryIndex | null {
  const lib = useCachedQuery<Library>(["library"], "/library").data;
  const custom = useCachedQuery<Exercise[]>(["custom-exercises"], "/exercises/custom").data;
  return useMemo(() => {
    if (!lib) return null;
    const exercises = [...lib.exercises, ...(custom ?? [])];
    const byId = new Map(exercises.map((e) => [e.id, e]));
    const disciplines = new Map(lib.disciplines.map((d) => [d.id, d]));
    return { lib, exercises, byId, discipline: (id: string) => disciplines.get(id) };
  }, [lib, custom]);
}

export function useGear() {
  return useCachedQuery<Gear[]>(["gear"], "/gear");
}

export function useRoutines() {
  return useCachedQuery<Routine[]>(["routines"], "/routines");
}

/** Every workout on this device, live: re-reads after any local or synced change. */
export function useWorkouts(): Workout[] | null {
  const [rows, setRows] = useState<Workout[] | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => void allWorkouts().then((w) => alive && setRows(w));
    load();
    const off = onWorkoutsChanged(load);
    return () => {
      alive = false;
      off();
    };
  }, []);
  return rows;
}

let syncState: SyncState = { pending: 0, syncing: false, lastError: null, lastSyncedAt: null, failed: [] };
export function useSyncState(): SyncState {
  return useSyncExternalStore(
    (cb) =>
      subscribeSync((s) => {
        syncState = s;
        cb();
      }),
    () => syncState,
  );
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener("online", cb);
      window.addEventListener("offline", cb);
      return () => {
        window.removeEventListener("online", cb);
        window.removeEventListener("offline", cb);
      };
    },
    () => navigator.onLine,
  );
}
