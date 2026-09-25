/**
 * Translation scaffolding.
 *
 * English is the only language today; this exists so adding a second one is
 * a data change, not a refactor. The rules:
 *
 * - Every message has a stable dotted key and lives in a catalog below. The
 *   English catalog is the source of truth and defines the key type, so a
 *   missing or misspelt key is a type error, not a blank label in production.
 * - Interpolation is `{name}`. Plurals use Intl.PluralRules categories
 *   (`one`, `other`, and whatever else a language needs) - never `n === 1`,
 *   which is wrong for most of the world's languages.
 * - Numbers and dates go through Intl with the active locale. Stored values
 *   stay in kg/metres/ISO dates; only display changes (see units.ts).
 *
 * Migrate strings to `t()` as screens are touched. The navigation is done.
 */

type Plural = { one?: string; other: string; zero?: string; two?: string; few?: string; many?: string };
type Message = string | Plural;

const en = {
  "nav.today": "Today",
  "nav.progress": "Progress",
  "nav.social": "Social",
  "nav.you": "You",
  "nav.notifications": "Notifications",
  "nav.leaderboards": "Leaderboards",
  "nav.tools": "Tools",
  "nav.settings": "Settings",
  "nav.moderation": "Moderation",
  "nav.log": "Log a session",
  "nav.home": "PaceStreak home",
  "nav.unread": { one: "{count} unread", other: "{count} unread" },
  "streak.weeks": { one: "{count} week", other: "{count} weeks" },
  "streak.sessions": { one: "{count} session", other: "{count} sessions" },
} satisfies Record<string, Message>;

export type MessageKey = keyof typeof en;
type Catalog = Partial<Record<MessageKey, Message>>;

// Additional languages register here: `de: () => import("./locales/de")`.
// Loaded lazily so a language nobody uses costs nothing to download.
const catalogs: Record<string, Catalog> = { en };

export const SUPPORTED = Object.keys(catalogs);

function detect(): string {
  const wanted = typeof navigator !== "undefined" ? navigator.languages ?? [navigator.language] : [];
  for (const tag of wanted) {
    const base = tag?.toLowerCase().split("-")[0];
    if (base && catalogs[base]) return base;
  }
  return "en";
}

let locale = detect();
let plurals = new Intl.PluralRules(locale);

export function getLocale() {
  return locale;
}

export function setLocale(next: string) {
  if (!catalogs[next]) return;
  locale = next;
  plurals = new Intl.PluralRules(locale);
  if (typeof document !== "undefined") document.documentElement.lang = locale;
}

function interpolate(text: string, vars: Record<string, string | number>) {
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? (typeof vars[name] === "number" ? formatNumber(vars[name] as number) : String(vars[name])) : match,
  );
}

/** A message in the active language, falling back to English per key. */
export function t(key: MessageKey, vars: Record<string, string | number> = {}): string {
  const message = catalogs[locale]?.[key] ?? en[key];
  if (typeof message === "string") return interpolate(message, vars);
  const count = typeof vars.count === "number" ? vars.count : 0;
  const form = (message as Plural)[plurals.select(count) as keyof Plural] ?? message.other;
  return interpolate(form, vars);
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(locale, options).format(value);
}
