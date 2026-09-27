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
 * Migrated so far: navigation, every signed-out screen (sign in, sign up,
 * password reset, email confirmation, unsubscribe), the shared loading and
 * error states, and the API client's own error messages - everything a new
 * person sees before their first session. i18n.guard.test.ts keeps those
 * files free of hard-coded text. Migrate the rest as screens are touched.
 *
 * Sentences with links or emphasis inside use tags in the message
 * ("agree to the <terms>terms</terms>") and `rich()` from i18n-rich.tsx,
 * so a translation can move the link to wherever its grammar needs it.
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

  "common.loading": "Loading",
  "common.email": "Email",
  "common.password": "Password",
  "common.signIn": "Sign in",
  "common.back": "Back",

  "errors.tooMany": "Too many attempts. Wait a minute and try again.",
  "errors.server": "Something went wrong on our side. Try again in a moment.",
  "errors.generic": "That didn't work.",
  "errors.unknown": "Something went wrong.",
  "errors.offline": "You're offline, or the server can't be reached.",

  "auth.login.title": "Welcome back.",
  "auth.login.subtitle": "Log in to keep the streak going.",
  "auth.login.newHere": "New here? <signup>Create an account</signup>",
  "auth.login.submit": "Sign in",
  "auth.login.busy": "Signing in…",
  "auth.login.passkey": "Sign in with a passkey",
  "auth.login.forgot": "Forgot your password?",
  "auth.mfa.title": "Two-factor code",
  "auth.mfa.subtitle": "Open your authenticator app, or use one of your recovery codes.",
  "auth.mfa.code": "Code",
  "auth.mfa.busy": "Checking…",

  "auth.signup.title": "Start your first streak.",
  "auth.signup.subtitle": "Ten seconds a session. Rest days never break it.",
  "auth.signup.haveAccount": "Already have an account? <signin>Sign in</signin>",
  "auth.signup.more": { one: "{count} more character", other: "{count} more characters" },
  "auth.signup.hint": "At least 16 characters. A short sentence is easier to remember than symbols.",
  "auth.signup.submit": "Create account",
  "auth.signup.busy": "Creating…",
  "auth.signup.agree": "By continuing you agree to the <terms>terms</terms> and <privacy>privacy policy</privacy>.",
  "auth.signup.verifyTitle": "Check your inbox.",
  "auth.signup.verifyBody": "We sent a link to {email}. Open it to finish creating your account.",

  "auth.forgot.title": "Reset your password.",
  "auth.forgot.sentTitle": "Check your inbox.",
  "auth.forgot.subtitle": "We'll email you a link. It works once and expires in 30 minutes.",
  "auth.forgot.submit": "Send reset link",
  "auth.forgot.busy": "Sending…",
  "auth.forgot.back": "Back to sign in",

  "auth.reset.incompleteTitle": "That link is incomplete.",
  "auth.reset.incompleteBody": "Open the link from the email again, or ask for a new one.",
  "auth.reset.requestNew": "Request a new link",
  "auth.reset.title": "Choose a new password.",
  "auth.reset.doneTitle": "Password updated.",
  "auth.reset.doneBody": "Every other session was signed out, which is the point of a reset.",
  "auth.reset.newPassword": "New password",
  "auth.reset.hint": "At least 16 characters.",
  "auth.reset.submit": "Set password",
  "auth.reset.busy": "Saving…",

  "auth.verify.working": "Confirming…",
  "auth.verify.doneTitle": "Email confirmed.",
  "auth.verify.doneBody": "Social features are unlocked.",
  "auth.verify.failTitle": "That link didn't work.",
  "auth.verify.failBody": "{error} Links expire after a day; you can send a new one from Settings.",
  "auth.verify.noToken": "This link has no token in it.",
  "auth.verify.open": "Open PaceStreak",
  "auth.verify.resend": "Send the link again",
  "auth.verify.resent": "Sent. Check your inbox.",

  "auth.unsubscribe.title": "Stop these emails?",
  "auth.unsubscribe.doneTitle": "Unsubscribed.",
  "auth.unsubscribe.body": "You can turn any category back on in Settings, Notifications.",
  "auth.unsubscribe.submit": "Unsubscribe",
  "auth.unsubscribe.settings": "Notification settings",

  "auth.login.lostAccess": "Lost access to your email?",
  "auth.recover.title": "Use a recovery code.",
  "auth.recover.subtitle": "If you turned on two-factor, each of the recovery codes you saved works once to set a new password, with no email needed.",
  "auth.recover.code": "Recovery code",
  "auth.recover.newPassword": "New password",
  "auth.recover.hint": "At least 16 characters. Every other session will be signed out.",
  "auth.recover.submit": "Set new password",
  "auth.recover.busy": "Checking…",
  "auth.recover.doneTitle": "Password updated.",
  "auth.recover.doneBody": "Sign in with it now. If your email address has changed, update it in Settings, Security.",
  "auth.recover.noCodes": "No two-factor, and no access to your email? Write to <mail>hello@pacestreak.com</mail> from any address and we'll help.",

  "auth.confirmEmail.working": "Confirming…",
  "auth.confirmEmail.doneTitle": "Email address updated.",
  "auth.confirmEmail.doneBody": "Use it to sign in from now on. We've told your old address.",
  "auth.confirmEmail.failTitle": "That link didn't work.",
  "auth.confirmEmail.failBody": "{error} Start the change again from Settings, Security.",
  "auth.confirmEmail.noToken": "This link has no token in it.",

  "terms.title": "We've updated the terms",
  "terms.body": "Please read what changed in the <terms>terms</terms> and the <privacy>privacy policy</privacy>. Everything you've logged stays yours either way.",
  "terms.accept": "I agree",
  "terms.busy": "Saving…",
  "terms.export": "Export my data first",
} satisfies Record<string, Message>;

export type MessageKey = keyof typeof en;
type Catalog = Partial<Record<MessageKey, Message>>;

// Additional languages register here: `de: () => import("./locales/de")`.
// Loaded lazily so a language nobody uses costs nothing to download.
const catalogs: Record<string, Catalog> = { en };

export const SUPPORTED = Object.keys(catalogs);

/** For tests: every catalog, by language. */
export const CATALOGS = catalogs;

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
