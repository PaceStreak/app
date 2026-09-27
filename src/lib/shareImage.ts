/**
 * Share images, drawn on the device. Nothing is uploaded: the picture is
 * made here and handed to the phone's own share sheet (or saved as a file
 * where sharing files isn't supported). It carries attendance only - days,
 * weeks, a streak - never a name, a handle or anything about a body.
 */

import { addDays } from "./dates";

const W = 1080;
const H = 1350;
const BG = "#0b0b0d";
const SURFACE = "#17171b";
const INK = "#f4f4f5";
const DIM = "#8b8b95";
const ACCENT = "#d3ff3e";
const LEVELS = ["#1f1f24", "#3b4a12", "#6b8a17", "#a3cc22", "#d3ff3e"];
const FONT = '"Archivo Variable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

function canvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  g.fillStyle = BG;
  g.fillRect(0, 0, W, H);
  return [c, g];
}

function text(g: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color = INK, weight = 600, align: CanvasTextAlign = "left") {
  g.font = `${weight} ${size}px ${FONT}`;
  g.fillStyle = color;
  g.textAlign = align;
  g.fillText(s, x, y);
}

function footer(g: CanvasRenderingContext2D) {
  g.fillStyle = ACCENT;
  g.beginPath();
  g.arc(92, H - 96, 14, 0, Math.PI * 2);
  g.fill();
  text(g, "PaceStreak", 124, H - 84, 40, INK, 700);
  text(g, "Rest days never break it.", W - 80, H - 84, 32, DIM, 500, "right");
}

export function drawWeek(opts: { weekStart: string; trained: string[]; days: number; target: number; kept: boolean; streak: number; label: string }): HTMLCanvasElement {
  const [c, g] = canvas();
  text(g, opts.label, 80, 170, 44, DIM, 500);
  text(g, opts.kept ? "Week kept." : "Week logged.", 80, 280, 104, INK, 700);
  text(g, `${opts.days}`, 80, 540, 240, ACCENT, 700);
  g.font = `700 240px ${FONT}`;
  const wide = g.measureText(`${opts.days}`).width;
  text(g, `of ${opts.target} ${opts.target === 1 ? "day" : "days"}`, 80 + wide + 28, 540, 64, DIM, 500);
  const size = 104;
  const gap = (W - 160 - size * 7) / 6;
  for (let i = 0; i < 7; i++) {
    const on = opts.trained.includes(addDays(opts.weekStart, i));
    g.fillStyle = on ? ACCENT : SURFACE;
    g.beginPath();
    g.roundRect(80 + i * (size + gap), 640, size, size, 28);
    g.fill();
  }
  if (opts.streak > 0) {
    text(g, `${opts.streak}-week streak`, 80, 900, 72, INK, 700);
    text(g, "Counted in weeks kept, not days trained.", 80, 970, 36, DIM, 500);
  }
  footer(g);
  return c;
}

export function drawGrid(opts: { days: { date: string; level: number }[]; today: string; weekStartsOn: number; activeDays: number; longest: number }): HTMLCanvasElement {
  const [c, g] = canvas();
  text(g, "Half a year of showing up", 80, 170, 56, INK, 700);
  text(g, `${opts.activeDays} days trained · longest streak ${opts.longest} weeks`, 80, 240, 36, DIM, 500);
  const weeks = 26;
  const levels = new Map(opts.days.map((d) => [d.date, d.level]));
  const offset = (new Date(`${opts.today}T00:00:00Z`).getUTCDay() + 6 - opts.weekStartsOn + 7) % 7;
  const start = addDays(opts.today, -offset - (weeks - 1) * 7);
  const cell = 30;
  const gap = (W - 160 - weeks * cell) / (weeks - 1);
  const top = 360;
  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 7; d++) {
      const day = addDays(start, w * 7 + d);
      if (day > opts.today) continue;
      g.fillStyle = LEVELS[Math.min(4, levels.get(day) ?? 0)];
      g.beginPath();
      g.roundRect(80 + w * (cell + gap), top + d * (cell + 12), cell, cell, 7);
      g.fill();
    }
  }
  text(g, "Each square is a day. Brighter means more.", 80, top + 7 * 42 + 90, 34, DIM, 500);
  footer(g);
  return c;
}

/** Hand the image to the share sheet, or save it where sharing files isn't possible. */
export async function shareCanvas(c: HTMLCanvasElement, name: string, title: string): Promise<"shared" | "saved" | "cancelled"> {
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
  if (!blob) throw new Error("Couldn't make the image");
  const file = new File([blob], `${name}.png`, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
      throw err;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "saved";
}
