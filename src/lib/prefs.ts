// Per-device preferences. localStorage is right here: these are
// conveniences for this browser, not account state, and every read is
// wrapped because storage can be unavailable (private mode, blocked site data).

export type Theme = "system" | "dark" | "light";
/** What the number on the home-screen icon means. */
export type BadgeMode = "unread" | "needed" | "off";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`ps.${key}`);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(`ps.${key}`, JSON.stringify(value));
  } catch {
    /* not persisted; fine */
  }
}

export const prefs = {
  theme: () => read<Theme>("theme", "system"),
  setTheme: (t: Theme) => {
    write("theme", t);
    applyTheme();
  },
  haptics: () => read<boolean>("haptics", true),
  setHaptics: (on: boolean) => write("haptics", on),
  sound: () => read<boolean>("sound", true),
  setSound: (on: boolean) => write("sound", on),
  autoRest: () => read<boolean>("autoRest", true),
  setAutoRest: (on: boolean) => write("autoRest", on),
  keepAwake: () => read<boolean>("keepAwake", true),
  setKeepAwake: (on: boolean) => write("keepAwake", on),
  badge: () => read<BadgeMode>("badge", "unread"),
  setBadge: (m: BadgeMode) => {
    write("badge", m);
    window.dispatchEvent(new Event("ps:badge"));
  },
  installDismissed: () => read<number>("installDismissed", 0),
  dismissInstall: () => write("installDismissed", Date.now()),
  dismissed: (key: string) => read<string[]>("dismissed", []).includes(key),
  dismiss: (key: string) => write("dismissed", [...read<string[]>("dismissed", []).slice(-200), key]),
};

const media = typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: light)") : null;

export function resolvedTheme(): "dark" | "light" {
  const t = prefs.theme();
  if (t !== "system") return t;
  return media?.matches ? "light" : "dark";
}

export function applyTheme() {
  const theme = resolvedTheme();
  document.documentElement.dataset.theme = theme;
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((m) => m.setAttribute("content", theme === "light" ? "#f3f4f5" : "#0a0a0b"));
}

media?.addEventListener("change", applyTheme);

export function haptic(pattern: number | number[] = 10) {
  if (!prefs.haptics()) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}

/** Disciplines picked at onboarding; orders the log grid until history takes over. */
export function favouriteDisciplines(): string[] {
  return read<string[]>("favDisciplines", []);
}
export function setFavouriteDisciplines(ids: string[]) {
  write("favDisciplines", ids);
}
