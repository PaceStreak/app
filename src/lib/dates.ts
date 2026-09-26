// Local calendar helpers. Dates travel as "YYYY-MM-DD" strings in the user's
// own timezone (the API computes local_date the same way), and are only ever
// turned into Date objects at noon UTC to dodge DST edges.

export const DAY = 86_400_000;
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const WEEKDAYS_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function parseDay(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`);
}

export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  return isoDay(new Date(parseDay(iso).getTime() + n * DAY));
}

/** 0 = Monday ... 6 = Sunday, matching Python's date.weekday(). */
export function weekday(iso: string): number {
  return (parseDay(iso).getUTCDay() + 6) % 7;
}

export function weekStart(iso: string, startsOn: number): string {
  return addDays(iso, -((weekday(iso) - startsOn + 7) % 7));
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / DAY);
}

export function localToday(tz?: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return isoDay(new Date());
  }
}

export function localDateOf(instant: Date, tz?: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
  } catch {
    return isoDay(instant);
  }
}

export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

const monthDay = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
const fullDay = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
const shortWeekday = new Intl.DateTimeFormat(undefined, { weekday: "short", timeZone: "UTC" });

export const fmtMonthDay = (iso: string) => monthDay.format(parseDay(iso));
export const fmtFullDay = (iso: string) => fullDay.format(parseDay(iso));
export const fmtWeekday = (iso: string) => shortWeekday.format(parseDay(iso));

const monthYear = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
export const fmtMonthYear = (iso: string) => monthYear.format(parseDay(iso));
/** A projected date: the day when it's within a few months, the month and
 * year when it's further off - a weekday a year away is false precision, and
 * a date without its year is simply misleading. */
export function fmtProjected(iso: string, today: string): string {
  return daysBetween(today, iso) <= 120 ? fmtFullDay(iso) : monthYear.format(parseDay(iso));
}

/** "Today", "Yesterday", "Tuesday", or "Mar 4" for older. */
export function relativeDay(iso: string, today: string): string {
  const diff = daysBetween(iso, today);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff > 1 && diff < 7) return fullDay.format(parseDay(iso)).split(",")[0];
  return fmtMonthDay(iso);
}

export function timeAgo(isoInstant: string): string {
  const sec = (Date.now() - new Date(isoInstant).getTime()) / 1000;
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  if (sec < 604800) return `${Math.floor(sec / 86400)}d`;
  return fmtMonthDay(isoInstant.slice(0, 10));
}

/**
 * For sentences: "just now", "5m ago", "3d ago", or "on 12 Sept" once it's
 * over a week. timeAgo() alone is for compact labels; appending "ago" to it
 * produced "just now ago" and "12 Sept ago".
 */
export function ago(isoInstant: string): string {
  const short = timeAgo(isoInstant);
  if (short === "just now") return short;
  return /^\d+[mhd]$/.test(short) ? `${short} ago` : `on ${short}`;
}

export function timeOfDay(isoInstant: string): string {
  return new Date(isoInstant).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** A datetime-local input value for an instant, in the browser's zone. */
export function toLocalInput(isoInstant: string): string {
  const d = new Date(isoInstant);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function uuid(): string {
  // uuid v7: time-ordered, like the API's own ids, so a client-minted
  // workout id sorts correctly among server-minted ones.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const ms = BigInt(Date.now());
  for (let i = 0; i < 6; i++) bytes[i] = Number((ms >> BigInt(8 * (5 - i))) & 0xffn);
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
