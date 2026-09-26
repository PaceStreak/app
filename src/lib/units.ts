// Stored values are always kilograms and metres. Everything here converts at
// the display edge and nowhere else - the predecessor app stored "whatever
// unit was selected" and a kg/lb switch silently corrupted every PR.

export type WeightUnit = "kg" | "lb";
export type DistanceUnit = "km" | "mi";

const LB = 0.45359237;
const MI = 1609.344;

export const toKg = (value: number, unit: WeightUnit) => (unit === "kg" ? value : value * LB);
export const fromKg = (kg: number, unit: WeightUnit) => (unit === "kg" ? kg : kg / LB);
export type LengthUnit = "cm" | "in";
export const toCm = (value: number, unit: LengthUnit) => (unit === "cm" ? value : value * 2.54);
export const fromCm = (cm: number, unit: LengthUnit) => (unit === "cm" ? cm : cm / 2.54);
export const toMetres = (value: number, unit: DistanceUnit) => value * (unit === "km" ? 1000 : MI);
export const fromMetres = (m: number, unit: DistanceUnit) => m / (unit === "km" ? 1000 : MI);

/** Round to the nearest plate-friendly step: 0.5 kg / 1 lb, trimmed. */
export function weight(kg: number | null | undefined, unit: WeightUnit, withUnit = true): string {
  if (kg == null) return "";
  const v = fromKg(kg, unit);
  const step = unit === "kg" ? 0.5 : 1;
  const rounded = Math.round(v / step) * step;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return withUnit ? `${text} ${unit}` : text;
}

export function distance(m: number | null | undefined, unit: DistanceUnit, withUnit = true): string {
  if (m == null) return "";
  const v = fromMetres(m, unit);
  const text = v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
  return withUnit ? `${text} ${unit}` : text;
}

export function duration(sec: number | null | undefined): string {
  if (sec == null) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  if (h) return `${h}h ${m.toString().padStart(2, "0")}m`;
  if (m) return s && m < 10 ? `${m}m ${s}s` : `${m} min`;
  return `${s}s`;
}

export function clock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = h ? m.toString().padStart(2, "0") : String(m);
  return `${h ? `${h}:` : ""}${mm}:${r.toString().padStart(2, "0")}`;
}

/** Pace per km or mile, e.g. "5:12 /km". */
export function pace(sec: number | null | undefined, m: number | null | undefined, unit: DistanceUnit): string {
  if (!sec || !m) return "";
  const per = sec / fromMetres(m, unit);
  return `${clock(per)} /${unit}`;
}

export function speed(sec: number | null | undefined, m: number | null | undefined, unit: DistanceUnit): string {
  if (!sec || !m) return "";
  const v = fromMetres(m, unit) / (sec / 3600);
  return `${v.toFixed(1)} ${unit === "km" ? "km/h" : "mph"}`;
}

export function parseNumber(text: string): number | null {
  const cleaned = text.trim().replace(",", ".");
  if (!cleaned) return null;
  const v = Number(cleaned);
  return Number.isFinite(v) ? v : null;
}

/** Session length → seconds. Bare numbers are minutes; "1:30" is h:mm
 * (a session is never measured in m:ss); "1:05:00" is h:mm:ss. Pass "ms"
 * for set-length holds, where "1:30" means a minute and a half. */
export function parseDuration(text: string, twoPart: "hm" | "ms" = "hm"): number | null {
  const t = text.trim();
  if (!t) return null;
  const parts = t.split(":").map((p) => Number(p));
  if (parts.some((p) => !Number.isFinite(p) || p < 0)) return null;
  if (parts.length === 1) return Math.round(parts[0] * 60);
  if (parts.length === 2) return twoPart === "hm" ? parts[0] * 3600 + parts[1] * 60 : parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

export function e1rm(kg: number, reps: number): number {
  if (reps <= 0 || kg <= 0 || reps > 12) return 0;
  return reps === 1 ? kg : kg * (1 + reps / 30);
}

export function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}

/** "1 day", "3 days". English-only by design until the rest of the UI moves
 * to the i18n catalog, which has proper plural rules. */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
