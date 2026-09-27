---
name: PaceStreak
description: A printed wall calendar you cross off in felt-tip marker; the chain of X's is the product.
colors:
  calendar-red: "#d6281f"
  calendar-red-text: "#b31d15"
  calendar-red-ink: "#ffffff"
  calendar-red-wash: "rgb(214 40 31 / 0.09)"
  marker-orange-flame: "#e8641b"
  marker-orange-flame-text: "#a5410a"
  info-blue: "#1f5fbf"
  danger: "#b3261e"
  coated-paper: "#fbfbf8"
  paper-shade: "#f5f5f1"
  paper-fill: "#f1f0eb"
  paper-fill-deep: "#e6e5df"
  printed-rule: "#dddcd6"
  printed-rule-lit: "#bebdb6"
  print-ink: "#141414"
  print-ink-muted: "#45454a"
  print-ink-dim: "#5c5c62"
  marker-red: "#d6281f"
  marker-blue: "#1f5fbf"
  marker-green: "#1d8048"
  marker-orange: "#d9661a"
  marker-violet: "#7440ad"
  heat-0: "#ebeae5"
  heat-1: "#f5cdc7"
  heat-2: "#ec9186"
  heat-3: "#dc4a3d"
  heat-4: "#b31d15"
  desk-lamp-paper: "#151517"
  desk-lamp-fill: "#212125"
  desk-lamp-fill-deep: "#2a2a2f"
  desk-lamp-rule: "#2c2c31"
  desk-lamp-rule-lit: "#3d3d44"
  chalk-ink: "#f2f0ea"
  chalk-ink-muted: "#b7b5ae"
  chalk-ink-dim: "#95938c"
  desk-lamp-red: "#ff4d3d"
  desk-lamp-red-text: "#ff7466"
  desk-lamp-red-ink: "#1c0604"
typography:
  date-numeral:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "3.4rem"
    fontWeight: 850
    lineHeight: 1
    letterSpacing: "-0.03em"
    fontVariation: "'wdth' 70"
    fontFeature: "'tnum' 1"
  count-numeral:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.6rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.025em"
    fontVariation: "'wdth' 82"
    fontFeature: "'tnum' 1"
  headline:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.03em"
    fontVariation: "'wdth' 88"
  title:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.15rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.015em"
    fontVariation: "'wdth' 88"
  body:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
    fontVariation: "'wdth' 100"
  label:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.4
  calendar-header:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.72rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.06em"
rounded:
  hairline: "1px"
  box: "2px"
  card: "4px"
  control: "4px"
spacing:
  grid-gap: "3px"
  gutter-tight: "0.75rem"
  gutter: "1rem"
  sheet: "1.25rem"
components:
  button-primary:
    backgroundColor: "{colors.calendar-red}"
    textColor: "{colors.calendar-red-ink}"
    rounded: "{rounded.control}"
    padding: "0 1.1rem"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.paper-fill}"
    textColor: "{colors.print-ink}"
    rounded: "{rounded.control}"
    padding: "0 1.1rem"
    height: "44px"
  button-secondary-hover:
    backgroundColor: "{colors.paper-fill-deep}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.print-ink}"
    rounded: "{rounded.control}"
    height: "44px"
  input:
    backgroundColor: "{colors.paper-fill}"
    textColor: "{colors.print-ink}"
    rounded: "{rounded.control}"
    padding: "0 0.95rem"
    height: "48px"
  input-focus:
    backgroundColor: "{colors.coated-paper}"
  chip:
    backgroundColor: "{colors.paper-fill}"
    textColor: "{colors.print-ink-muted}"
    rounded: "{rounded.card}"
    padding: "0 0.7rem"
    height: "28px"
  chip-accent:
    backgroundColor: "{colors.calendar-red-wash}"
    textColor: "{colors.calendar-red-text}"
    rounded: "{rounded.card}"
  card:
    backgroundColor: "{colors.coated-paper}"
    rounded: "{rounded.card}"
  tearoff-head:
    backgroundColor: "{colors.calendar-red}"
    textColor: "{colors.calendar-red-ink}"
    typography: "{typography.calendar-header}"
  tearoff-day:
    backgroundColor: "{colors.coated-paper}"
    textColor: "{colors.print-ink}"
    typography: "{typography.date-numeral}"
    width: "6.25rem"
  board-day:
    textColor: "{colors.print-ink-dim}"
    height: "3rem"
  board-day-today:
    backgroundColor: "{colors.calendar-red-wash}"
    textColor: "{colors.calendar-red-text}"
  log-cap:
    backgroundColor: "{colors.calendar-red}"
    textColor: "{colors.calendar-red-ink}"
    size: "56px"
  tick-box:
    backgroundColor: "{colors.coated-paper}"
    rounded: "{rounded.box}"
    size: "20px"
---

# Design System: PaceStreak

## Overview

**Creative North Star: "The Wall Calendar Chain"**

PaceStreak is a printed wall calendar crossed off in felt-tip marker. The surface is bright coated calendar paper, not cream; type and rules are hard black print; the one loud colour is printed calendar red, the red a calendar uses for today and Sundays. Habits are drawn in a small felt-tip set, so each habit's X comes out of its own marker. Dark mode isn't a neon dashboard. It's the same calendar at night under a desk lamp: charcoal paper with chalk-white ink and a warmer, brighter red.

The density is a calendar grid: 1px printed rules, square boxes, condensed heavy numerals for every date and count, and normal-width Archivo for reading. Depth comes from print, not light. There are no card shadows. Surfaces are separated by rules and slight paper tints. The one authored motion is the marker stroke. When a box is ticked, a hand-drawn X draws itself across the date in two strokes. It's slightly uneven on purpose, so it reads as a hand's mark and not a UI checkmark.

The world refuses the category default of rounded cards, progress rings and a dark neon dashboard. The old lime-on-near-black look is retired completely.

**Key Characteristics:**
- Coated paper (#fbfbf8) and black print ink (#141414); calendar red reserved for today, Sundays, the streak and the primary action.
- A felt-tip marker set (red, blue, green, orange, violet) assigned to habits by category.
- 1px printed grid rules, square 4px corners, no shadows.
- Archivo variable: condensed (70-88% width) and heavy for numerals and headings, 100% width for text.
- A marker X drawn in two strokes (150ms each, the second 120ms later) is the only signature motion.

## Colors

Printed matter: black on bright coated paper, one calendar red, and a felt-tip set for the habits.

### Primary
- **Calendar Red** (calendar-red): today, the primary action (Log button, primary buttons), the tear-off header band, selection, the active tab and index-tab rule, and the default marker X. As a fill under white text it measures 5.0:1.
- **Calendar Red, Text** (calendar-red-text): red used as text or line on paper, such as the chain count, Sunday letters, links to totals, the focus ring and the caret (6.6:1 on paper).
- **Red Wash** (calendar-red-wash): the tint inside today's column and done set rows, and accent chips.

### Secondary
- **Orange Marker / Flame** (marker-orange-flame, marker-orange-flame-text): streak fire, risk, and the ring drawn around a slipped day on a habit being quit.
- **Info Blue** (info-blue): informational toasts, rest and get-ready phases, frozen weeks.
- **Danger** (danger): destructive actions and field errors only.

### Tertiary: the felt-tip set
- **Marker Red / Blue / Green / Orange / Violet** (marker-*): the colour each habit's X is drawn in, mapped by category. Learning and creative get blue. Health and home get green. Mind and social get violet. Money and productivity get orange. Everything else gets red. The green, orange and violet are deeper than the direction contract's first values (#1f8a4c, #ef7d22, #7b3fb5). The build wins.

### Neutral
- **Coated Paper** (coated-paper): page background and card surface. They are the same sheet.
- **Paper Shade / Fill / Fill Deep** (paper-shade, paper-fill, paper-fill-deep): alternating bands, inputs and secondary buttons, then hover and pressed fills.
- **Printed Rule / Rule Lit** (printed-rule, printed-rule-lit): 1px grid lines and card borders, with the lit rule for raised edges (tear-off, sheets, toasts).
- **Print Ink / Muted / Dim** (print-ink, print-ink-muted, print-ink-dim): text in three weights of emphasis. Dim is the floor at 6.1:1 on paper. No grey goes lighter.
- **Heat ramp** (heat-0 to heat-4): marker pressure on the year grid, from an empty box to a heavy red X.

### Dark: the desk lamp
- **Charcoal Paper** (desk-lamp-paper), **fills** (desk-lamp-fill, desk-lamp-fill-deep), **rules** (desk-lamp-rule, desk-lamp-rule-lit), **Chalk Ink** (chalk-ink, chalk-ink-muted, chalk-ink-dim at 5.9:1), **Lamp Red** (desk-lamp-red, desk-lamp-red-text, with desk-lamp-red-ink under it). Every light token has a dark twin under `[data-theme="dark"]`. The marker set and heat ramp brighten to match.

### Named Rules
**The Calendar Red Rule.** Red marks what a printed calendar marks in red: today, Sundays, the streak, and the one action that crosses a day off. It is never decoration and never a second accent.

**The Measured Grey Rule.** Every muted text colour is measured against the paper it sits on. Dim is the lightest grey allowed (6.1:1 light, 5.9:1 dark).

## Typography

**Display Font:** Archivo Variable, condensed (with ui-sans-serif, system-ui fallback)
**Body Font:** Archivo Variable, normal width (same stack)
**Label/Mono Font:** ui-monospace stack, rarely used

**Character:** One family with a width axis. Numerals and headings are set narrow and heavy, the way dates are printed on a calendar grid. Reading text stays at full width.

### Hierarchy
- **Date numeral** (850, 3.4rem, 70% width, line-height 1): the tear-off day number.
- **Count numeral** (800, 2.6rem, 82% width): the whole-life chain count, in calendar red text.
- **Headline** (600, 2rem, line-height 1.1, -0.03em, 88% width): page titles. Secondary pages use 1.65rem.
- **Title** (600-700, 1.05-1.25rem, 88% width): section heads such as "This week".
- **Body** (400, 16px, line-height 1.5): all running text.
- **Label** (600, 0.8125rem): field labels, hints, chips.
- **Calendar header** (700, 0.72rem, +0.06em, uppercase): the weekday on the tear-off band and the narrow weekday letters over board columns. Uppercase belongs to the calendar's own printed headers.

### Named Rules
**The Printed Numeral Rule.** Every date, count and measure is condensed and tabular (`.num`: 82% width, tabular-nums), so columns line up like a printed grid.

## Layout

The app is a mobile-first single column (max 560px under the tab bar), with a sidebar at `lg` (1024px). The spatial model is the calendar week: seven equal columns (`repeat(7, minmax(0, 1fr))`) separated by 1px rules. A habit's name spans all seven columns above its row of date boxes. Boxes are 3rem tall. The year grid packs square cells with a 3px gap. The month view on a habit is a 7-column grid whose 1px gaps show the rule colour through. Page gutters are 1rem. Sheets pad 1.25rem. Sheets rise from the bottom on phones and centre as dialogs from 640px. The Today header puts the tear-off block (6.25rem wide) beside the chain count.

## Elevation & Depth

The system is flat. `--shadow` is `none` in both themes. Depth is print: a 1px rule, a lit rule for anything that sits on top (tear-off, sheet, toast), and slight paper tints. Only three box-shadow uses remain, and none is a cast shadow. The first is inset rules: today's 1.5px red outline, the 3px red index-tab bar on the active tab and segment, and outlined heat cells. The second is the Log cap's 4px paper-coloured ring that cuts it out of the tab bar rule. The third is the cap's darker clip band.

### Named Rules
**The Print, Not Light Rule.** Nothing casts a shadow. If something needs to sit above something else, give it a rule or a tint.

## Shapes

Corners are square, like a printed calendar. Cards, controls and chips use 4px. The tick box uses 2px. Heat cells and week dots use 1px. The Log button is a marker cap: 6px on top and 4px at the base, with a clip band across the bottom. Index tabs (segmented controls, the tab bar) have no radius. They are a ruled edge with a 3px red bar on the current one. The marker marks are open SVG paths with round caps at stroke width 4.6 in a 40-unit box. The logo is a calendar page with a red header and two binder pegs, crossed off in red.

## Components

### Buttons
- **Shape:** square-cornered (4px), 44px tall (36px small), weight 650.
- **Primary:** calendar red with white ink. Hover brightens it slightly (brightness 1.06). Press scales it to 0.97 over 160ms.
- **Secondary / Ghost:** a paper-fill button with a 1px rule, or transparent. Both darken to paper-fill-deep on hover.
- **Danger:** a danger wash with danger text and a 30% danger rule.

### Chips
- **Style:** 28px tall, 4px corners, paper fill with a rule, muted text. The accent and flame variants use a wash and coloured text with no border.

### Cards / Containers
- **Corner Style:** 4px.
- **Background:** coated paper, the same as the page, with a 1px printed rule. The raised variant uses the lit rule.
- **Shadow Strategy:** none (see Elevation).
- **Internal Padding:** 1rem.

### Inputs / Fields
- **Style:** 48px tall, paper fill, 1px rule, 4px corners.
- **Focus:** the border turns calendar-red-text and the fill lightens to paper. The global focus ring is a 2px calendar-red-text outline at a 2px offset.
- **Error:** a danger border and a danger message below.

### Navigation
- **Tab bar:** calendar index tabs. The bar sits on a 1px ink rule. Labels are 0.7rem at weight 600. The current tab turns ink and gets a 3px red bar along the rule. The Log cap sits raised in the centre.
- **Segmented control:** planner section tabs on a 1px ink rule. The selected tab has red text at weight 750 and a 3px red underline.

### The Week Board (signature)
Seven columns of date boxes, one row per habit. Today's column is washed red and outlined in 1.5px red. Future boxes are faded and disabled. A done day gets a marker X in the habit's colour, and the printed date fades to 35% under it. A part-done day gets a single slash. A slip on a habit being quit gets an orange ring.

### The Tear-off Block (signature)
A torn-off calendar page: a red header band with the uppercase weekday, then a dashed perforation, a huge condensed day number, and the month and year in muted text.

### Marker Marks and the Tick Box (signature)
MarkerX, MarkerSlash and MarkerRing draw their strokes in (`stroke-dashoffset` over 150ms, the second stroke 120ms later), and appear instantly with reduced motion. The TickBox is a 2px-cornered printed box with a 1.5px ink border. It is crossed off with MarkerX, so there is exactly one way "done" looks in the product.

### Sibling surfaces
`web/` (www) and `blog/` share the paper, rule, ink and Archivo tokens through their own `@theme` blocks. The www hero uses a calendar page (`CalendarPage.astro`), and `public/marks/` ships the X and tick as static SVGs.

## Do's and Don'ts

### Do:
- **Do** separate surfaces with a 1px printed rule and a paper tint, never a shadow.
- **Do** mark done with a MarkerX drawn in the habit's category marker, and keep the date visible underneath at reduced opacity.
- **Do** set every date and count in condensed, tabular Archivo (`.num`).
- **Do** keep calendar red for today, Sundays, the streak and the Log action.
- **Do** define every colour in both the paper theme and the desk-lamp theme.
- **Do** keep the marker stroke as the one authored motion, and show it instantly under reduced motion.

### Don't:
- **Don't** add card shadows, glows or progress rings. The world is print.
- **Don't** round corners past 4px on cards, controls or boxes; the marker cap's 6px top is the one exception, because a real cap has it.
- **Don't** bring back the old lime-on-near-black palette, and don't treat dark mode as a neon dashboard. Dark is the same calendar under a desk lamp.
- **Don't** invent a second "done" mark. The tick box and board both use the marker X.
- **Don't** use a grey lighter than print-ink-dim for text.
