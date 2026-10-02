// When to offer installing the app. Per-device, like every other prefs key:
// it is about this browser, and every storage access is wrapped because
// storage can be unavailable.

export type InstallMoment = "welcome" | "return" | "logged";

const KEY = "ps.installMoments";
const DAYS = "ps.visitDays";
const TAB = "ps.visitCounted";

function readList(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function writeList(key: string, list: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    /* not persisted; the offer may come again, which is harmless */
  }
}

const today = () => new Date().toLocaleDateString("en-CA");

/** Count this visit once per tab and return how many distinct days this
 * device has opened the app on. */
export function recordVisit(): number {
  let days = readList(DAYS);
  try {
    if (sessionStorage.getItem(TAB)) return days.length;
    sessionStorage.setItem(TAB, "1");
  } catch {
    /* no session storage: count every load, which only dedupes by day anyway */
  }
  if (!days.includes(today())) {
    days = [...days, today()].slice(-30);
    writeList(DAYS, days);
  }
  return days.length;
}

export const markInstallMoment = (m: InstallMoment) => {
  const used = readList(KEY);
  if (!used.includes(m)) writeList(KEY, [...used, m]);
};

/** The moment to offer now, if any. `visitDays` is from recordVisit (null
 * when not a page open); `logged` means a session was just saved. A moment
 * is used up once it has been on screen, answered or not. */
export function installMoment(visitDays: number | null, logged = false): InstallMoment | null {
  const used = readList(KEY);
  if (logged) return used.includes("logged") ? null : "logged";
  if (visitDays == null) return null;
  if (!used.includes("welcome")) return "welcome";
  if (visitDays >= 2 && !used.includes("return")) return "return";
  return null;
}
