// Regenerates public/icons/shortcut-*.png: one 96x96 icon per home-screen
// shortcut in manifest.webmanifest, drawn from the same Phosphor family the
// app uses, so a long-press menu reads at a glance instead of showing four
// identical icons.
//
//   node scripts/shortcut-icons.mjs        (needs rsvg-convert on PATH)
//
// The PNGs are committed; this only runs when an icon changes.
import { execFileSync } from "node:child_process";
import { writeFileSync, rmSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BookOpenText, ChartLineUp, ForkKnife, Lightning, ListChecks, MagnifyingGlass, Plus } from "@phosphor-icons/react/ssr";

const ICONS = {
  log: Plus,
  live: Lightning,
  progress: ChartLineUp,
  food: ForkKnife,
  journal: BookOpenText,
  routine: ListChecks,
  search: MagnifyingGlass,
};

const ACCENT = "#d3ff3e";
const INK = "#14170a";

for (const [name, Icon] of Object.entries(ICONS)) {
  const glyph = renderToStaticMarkup(createElement(Icon, { size: 52, weight: "bold", color: INK }));
  // Lime disc on transparent: Android masks shortcut icons to a circle, and a
  // full-bleed disc survives any mask shape without clipping the glyph.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <circle cx="48" cy="48" r="46" fill="${ACCENT}"/>
  <g transform="translate(22 22)">${glyph}</g>
</svg>`;
  const tmp = `public/icons/.shortcut-${name}.svg`;
  writeFileSync(tmp, svg);
  execFileSync("rsvg-convert", ["-w", "96", "-h", "96", "-o", `public/icons/shortcut-${name}.png`, tmp]);
  rmSync(tmp);
  console.log(`public/icons/shortcut-${name}.png`);
}
