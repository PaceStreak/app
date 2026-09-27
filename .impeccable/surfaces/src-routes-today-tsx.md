---
version: 1
slug: "src-routes-today-tsx"
primary_target: "src/routes/Today.tsx"
related_targets: ["src/routes/habits/HabitDetail.tsx"]
---

# Surface: the whole app, led by Today and the habit calendar

Scope: every route in app/, the shell, sheets; the same world carries to web/ and blog/. Mode: Operate (web: Persuade, blog: Read, sharing tokens).
Audience: anyone keeping habits weekly (training, learning, health, quitting), on a phone, morning and evening, often one-handed.
Job: see which days are crossed off and cross off today in one tap.

## Direction contract

THESIS: PaceStreak is a printed wall calendar you cross off in felt-tip marker: the chain of X's is the product. Refuses the category default of rounded cards, progress rings and a dark neon dashboard.

OWN-WORLD: Bright coated calendar paper (#fbfbf8, not cream), hard black print ink (#141414), printed calendar red (#d6281f) for today, Sundays and the streak; felt-tip marker set as habit colours (red, blue #1f5fbf, green #1f8a4c, orange #ef7d22, violet #7b3fb5). 1px printed grid rules, square 4px corners, no card shadows; Archivo variable, condensed heavy numerals for dates and counts, normal width for text. Dark: the same calendar under a desk lamp, charcoal paper #151517 with chalk ink.

STORY: The user opens the app to today's tear-off page, sees their habits as rows of this week's boxes, taps today's box and a marker X draws across it; the chain lengthens and the week tally updates.

FIRST VIEWPORT: Top: a tear-off date block (weekday, huge condensed day number, month) beside the whole-life chain count in red. Below: "This week" ruled grid, one row per habit with seven date boxes, today's column outlined in red. Log button is a red marker cap. Tab bar is calendar-tab strips.

FORM: Wall Calendar Chain, position 1 on the ordered list (IMPECCABLE'S PICK over roll 3); seed key 34a724d3.
Signature interaction: ticking draws a hand-drawn marker X over the date (SVG stroke-dashoffset, two strokes, ~260ms, ease-out); unticking fades it; reduced motion shows it instantly.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
