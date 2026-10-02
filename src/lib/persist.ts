import { useCallback, useState } from "react";

/**
 * useState that this device remembers: the last tab or filter on a screen
 * comes back next time. `allowed` guards against a stored value that no
 * longer exists (a renamed tab), falling back to the default. Storage can be
 * unavailable (private mode), in which case it is plain useState.
 */
/** The stored value for a view, or `initial` when missing, unreadable, of
 * the wrong type, or no longer one of `allowed`. */
export function readView<T extends string | number>(key: string, initial: T, allowed?: readonly T[]): T {
  try {
    const raw = localStorage.getItem(`ps.view.${key}`);
    if (raw == null) return initial;
    const parsed = JSON.parse(raw) as T;
    return typeof parsed === typeof initial && (!allowed || allowed.includes(parsed)) ? parsed : initial;
  } catch {
    return initial;
  }
}

export function usePersistentState<T extends string | number>(key: string, initial: T, allowed?: readonly T[]): [T, (v: T) => void] {
  const storageKey = `ps.view.${key}`;
  const [value, setValue] = useState<T>(() => readView(key, initial, allowed));
  const set = useCallback(
    (v: T) => {
      setValue(v);
      try {
        localStorage.setItem(storageKey, JSON.stringify(v));
      } catch {
        /* not remembered; fine */
      }
    },
    [storageKey],
  );
  return [value, set];
}
