---
name: PaceStreak
description: A near-black training log where the week is a calendar page you cross off in marker; lime is the one action, flame is the streak.
colors:
  lime: "#d3ff3e"
  lime-ink: "#14170a"
  lime-wash: "rgb(211 255 62 / 0.12)"
  lime-text-day: "#4a6300"
  lime-wash-day: "rgb(120 160 0 / 0.14)"
  flame: "#ff6b35"
  flame-text: "#ff8a5c"
  flame-wash: "rgb(255 107 53 / 0.14)"
  flame-day: "#f25a1f"
  flame-text-day: "#a8390b"
  info-sky: "#7cc7ff"
  info-day: "#095f9e"
  danger: "#ff6b6b"
  danger-day: "#b71c1c"
  near-black: "#0a0a0b"
  near-black-alt: "#0e0e10"
  night-surface: "#141417"
  night-surface-2: "#1a1a1e"
  night-surface-3: "#222228"
  night-rule: "#26262c"
  night-rule-lit: "#34343d"
  night-ink: "#f4f4f5"
  night-ink-muted: "#a1a1aa"
  night-ink-dim: "#8b8b95"
  day-ground: "#f3f4f5"
  day-ground-alt: "#eceef0"
  day-surface: "#fbfbfc"
  day-surface-2: "#eef0f2"
  day-surface-3: "#e3e6e9"
  day-rule: "#dcdfe3"
  day-rule-lit: "#c6cad0"
  day-ink: "#111214"
  day-ink-muted: "#4b4f57"
  day-ink-dim: "#5b606a"
  marker-blue: "#7cc7ff"
  marker-green: "#4fd98a"
  marker-orange: "#ff8a5c"
  marker-violet: "#c29bff"
  marker-default-day: "#4a7400"
  marker-blue-day: "#1f5fbf"
  marker-green-day: "#1d8048"
  marker-orange-day: "#c2410c"
  marker-violet-day: "#7440ad"
  heat-0: "#1c1c21"
  heat-1: "#34420f"
  heat-2: "#5f7c16"
  heat-3: "#9ac72a"
  heat-4: "#d3ff3e"
  heat-0-day: "#e3e6e9"
  heat-1-day: "#dbf4a2"
  heat-2-day: "#b4e257"
  heat-3-day: "#82bd1c"
  heat-4-day: "#4a7400"
  chart-olive: "#7fa214"
  chart-olive-day: "#6a8f00"
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
  page-title:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.65rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.02em"
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
  cell: "3px"
  tick: "5px"
  md: "6px"
  control: "12px"
  card: "16px"
  toast: "18px"
  sheet: "24px"
  pill: "999px"
spacing:
  grid-gap: "3px"
  gutter-tight: "0.75rem"
  gutter: "1rem"
  sheet: "1.25rem"
components:
  button-primary:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.lime-ink}"
    rounded: "{rounded.pill}"
    padding: "0 1.1rem"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.night-surface-2}"
    textColor: "{colors.night-ink}"
    rounded: "{rounded.pill}"
    padding: "0 1.1rem"
    height: "44px"
  button-secondary-hover:
    backgroundColor: "{colors.night-surface-3}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.night-ink}"
    rounded: "{rounded.pill}"
    height: "44px"
  input:
    backgroundColor: "{colors.night-surface-2}"
    textColor: "{colors.night-ink}"
    rounded: "{rounded.control}"
    padding: "0 0.95rem"
    height: "48px"
  input-focus:
    backgroundColor: "{colors.night-surface}"
  chip:
    backgroundColor: "{colors.night-surface-2}"
    textColor: "{colors.night-ink-muted}"
    rounded: "{rounded.pill}"
    padding: "0 0.7rem"
    height: "28px"
  chip-accent:
    backgroundColor: "{colors.lime-wash}"
    textColor: "{colors.lime}"
    rounded: "{rounded.pill}"
  chip-flame:
    backgroundColor: "{colors.flame-wash}"
    textColor: "{colors.flame-text}"
    rounded: "{rounded.pill}"
  card:
    backgroundColor: "{colors.night-surface}"
    rounded: "{rounded.card}"
  tearoff-head:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.lime-ink}"
    typography: "{typography.calendar-header}"
  tearoff-day:
    backgroundColor: "{colors.night-surface}"
    textColor: "{colors.night-ink}"
    typography: "{typography.date-numeral}"
    width: "6.25rem"
  board-day:
    textColor: "{colors.night-ink-dim}"
    height: "3rem"
  board-day-today:
    backgroundColor: "{colors.lime-wash}"
    textColor: "{colors.lime}"
  log-button:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.lime-ink}"
    rounded: "{rounded.pill}"
    size: "56px"
  tick-box:
    backgroundColor: "{colors.night-surface-2}"
    rounded: "{rounded.tick}"
    size: "20px"
---

# Design System: PaceStreak

## Overview

**Creative North Star: "The Night Calendar"**

PaceStreak is a wall calendar you cross off in marker, rendered on a near-black ground. The ground is almost black (near-black) with slightly lifted surfaces. One colour does the work: a hard electric lime that means "do this" (log, save, today). The streak has its own colour, flame orange, used for the chain count, risk and slips. There is a daylight theme under `[data-theme="light"]`. It is a cool pale grey ground with white cards. Lime stays the fill there, but lime used as text deepens to an olive (lime-text-day), because raw lime is unreadable on light grounds.

The structure comes from a paper calendar. The week board sets out seven date boxes per habit. A done day is crossed off with a hand-drawn marker X. A tear-off date block sits at the top of Today. The logo is the lime bolt. Numerals are condensed and heavy, like printed dates. Everything else is a calm modern app: soft rounded cards (16px), rounded controls (12px), pill buttons and chips, and soft ambient shadows on raised things. Reading text uses full-width Archivo.

The user rejected the paper-and-calendar-red palette ("meh and edgy"), so it is not coming back. The calendar survives as structure, not as colour.

**Key Characteristics:**
- Near-black ground (#0a0a0b) with stepped surfaces; a light theme mirrors every token.
- Lime (#d3ff3e) is the single action colour; flame (#ff6b35) is the streak, risk and slips.
- A habit marker set (blue, green, orange, violet, default lime/olive) colours each habit's X by category.
- Soft corners (16px cards, 12px controls, pills for buttons and chips) and soft ambient shadows on raised surfaces only.
- Archivo variable: condensed (70-88% width) and heavy for numerals and headings, 100% width for text.
- The marker X, slash and ring, drawn in over 150ms, are the only marks for a day's state.

## Colors

Near-black and lime, with flame for the streak. Every token has a light twin.

### Primary
- **Electric Lime** (lime): the primary button, the mobile Log button, the tear-off header band, selection, switches when on, trained week dots, gold badges and the work phase of the interval timer. Lime ink (lime-ink) goes on top of it at 15.7:1.
- **Lime as text**: in dark mode, lime itself is the text colour (15.9:1 on surface): today's column, the "done of total" link, focus rings, the caret. In light mode that role goes to **Olive** (lime-text-day, 6.6:1 on surface).
- **Lime Wash** (lime-wash, lime-wash-day): the tint in today's board column, done set rows and accent chips.

### Secondary
- **Flame** (flame, flame-text, flame-wash and their day twins): the whole-life chain count, streak and at-risk states, the ring around a slipped day on a habit being quit, drop and failure sets, bronze badges. Flame text measures 7.9:1 on the dark surface and 6.2:1 on the light one.
- **Info Sky** (info-sky / info-day): informational toasts, rest and get-ready phases, frozen weeks, warm-up sets.
- **Danger** (danger / danger-day): destructive actions and field errors only.

### Tertiary: the marker set
- **Marker Blue / Green / Orange / Violet** (marker-*): the colour each habit's X is drawn in, by category. Learning and creative get blue. Health and home get green. Mind and social get violet. Money and productivity get orange. Everything else gets the default marker. The default marker is lime at night and deep olive (marker-default-day) by day. In code the default is the `--marker-red` variable, which is left over from the calendar palette and now holds lime or olive. The day set is deeper so it reads on white.
- **Heat ramp** (heat-0 to heat-4, with day twins): a lime ramp of fill levels on the year grid.
- **Chart Olive** (chart-olive / chart-olive-day): bars, kept weeks and muscle fills. It is a darker lime, checked for chart use, because full lime sits outside the dark chart lightness band.

### Neutral
- **Near-black ground** (near-black, near-black-alt): the page and alternating bands. **Day Ground** (day-ground, day-ground-alt) is the light twin.
- **Surfaces** (night-surface, -2, -3 / day-surface, -2, -3): cards, then inputs and secondary buttons, then hover, pressed and empty states.
- **Rules** (night-rule, night-rule-lit / day-rule, day-rule-lit): 1px borders and board lines. The lit rule marks raised things: the tear-off block, sheets, toasts, the tick box.
- **Ink** (night-ink, -muted, -dim / day-ink, -muted, -dim): text at three levels of emphasis. Dim is the floor: 5.87:1 on the dark ground and 5.45:1 on the dark surface, 6.1:1 on the light surface.

### Named Rules
**The One Lime Rule.** Lime means act or today: the primary action, today's box and the tear-off band, done states, selection. It is never decoration and never a second meaning.

**The Flame Is the Chain Rule.** Flame belongs to the streak and risk to it. The count, a slip, a warning. Nothing else is orange except the orange habit marker.

**The Lime Never Reads on Day Rule.** On the light theme, lime is a fill with lime-ink on it, never text or a line. Text and strokes use lime-text-day.

**The Measured Grey Rule.** Every muted text colour is measured on the surface it sits on, cards included. Dim is the lightest grey allowed.

## Typography

**Display Font:** Archivo Variable, condensed (self-hosted via @fontsource-variable, with ui-sans-serif, system-ui fallback)
**Body Font:** Archivo Variable, normal width (same stack)
**Label/Mono Font:** ui-monospace stack, rarely used

**Character:** One family with a width axis. Numerals and headings are set narrow and heavy, the way dates are printed on a calendar grid. Reading text stays at full width.

### Hierarchy
- **Date numeral** (850, 3.4rem, 70% width, line-height 1): the tear-off day number.
- **Count numeral** (800, 2.6rem, 82% width): the whole-life chain count, in flame text. Stat values use the same treatment at 2rem.
- **Headline** (600, 2rem, line-height 1.1, -0.03em, 88% width): auth and onboarding titles.
- **Page title** (600, 1.65rem, -0.02em): secondary page headers.
- **Title** (700, 1.15rem, 88% width): section heads such as "This week".
- **Body** (400, 16px, line-height 1.5): all running text.
- **Label** (600, 0.8125rem): field labels, hints, chips.
- **Calendar header** (700, 0.72rem, +0.06em, uppercase): the weekday on the tear-off band. The weekday letters over the board columns (0.68rem, bold, uppercase) follow it. This is the calendar's own printed header, not a section label.

### Named Rules
**The Printed Numeral Rule.** Every date, count and measure is condensed and tabular (`.num`: 82% width, tabular-nums), so columns line up like a printed grid.

## Layout

The app is mobile first. It is one column, max 560px, above a fixed five-slot tab bar with Log in the centre. At 1024px it becomes a 248px sidebar plus content (max 720px). The spatial model on Today is the calendar week: seven equal columns (`repeat(7, minmax(0, 1fr))`) separated by 1px rules. Each habit's name spans the full row above its seven 3rem date boxes. The Today header puts the tear-off block (6.25rem wide) beside the chain count. The year grid packs square cells with a 3px gap. Page gutters are 1rem and sheets pad 1.25rem. Sheets rise from the bottom on phones and become centred dialogs from 640px. Route content settles in once (240ms, 6px rise). List entry is staggered in 40ms steps, capped at 160ms.

## Elevation & Depth

The system is a hybrid: tonal layers first, then soft ambient shadows on things that float. Cards at rest are a surface tone with a 1px rule and no shadow. Raised cards, the tear-off block, sheets, toasts, tooltips and the lead coach card carry `--shadow`, a soft ambient drop. At night it adds a faint top highlight. The two Log buttons carry a lime-tinted drop. The mobile one also has a 5px ground-coloured ring that cuts it out of the tab bar. Inset rings mark state rather than depth: today's box, rest and planned heat cells, open weeks.

### Shadow Vocabulary
- **Ambient, dark** (`box-shadow: 0 1px 0 rgb(255 255 255 / 0.04) inset, 0 12px 32px -12px rgb(0 0 0 / 0.6)`): anything that floats, at night.
- **Ambient, light** (`box-shadow: 0 1px 2px rgb(17 18 20 / 0.06), 0 12px 28px -14px rgb(17 18 20 / 0.22)`): the same role by day.
- **Log lift** (`box-shadow: 0 0 0 5px var(--bg), 0 10px 24px -6px color-mix(in srgb, var(--accent) 45%, transparent)`): the mobile Log button only. The sidebar version is `0 10px 24px -10px` at 55%.
- **Today ring** (`box-shadow: inset 0 0 0 1.5px var(--accent-text)`): today's board box.

### Named Rules
**The Float, Not Rest Rule.** Shadows go only on things that sit above the page: sheets, toasts, the tear-off block, raised cards, Log. Plain cards stay flat, with a rule and a tone.

## Shapes

Corners are soft and consistent. Cards use 16px, controls and inputs 12px, and buttons, chips, switches and avatars are full pills. Toasts use 18px. Bottom sheets use 24px on their top corners. The tear-off block uses 14px, the tick box 5px, and heat cells and week marks 3px. Small inline elements use 6px (the Tailwind md radius). The marker marks are open SVG paths with round caps, at stroke width 4.6 in a 40-unit box, and are slightly uneven on purpose. The logo is the original lime bolt, a single six-point path; the calendar-page mark was dropped because an X in a corner reads as "close".

## Components

### Buttons
- **Shape:** full pill (999px), 44px tall (36px for small, 44px square for icon buttons), weight 650.
- **Primary:** a lime fill with lime ink. Hover brightens it (brightness 1.06, fine pointers only). Press scales it to 0.97 over 160ms.
- **Secondary / Ghost:** surface-2 with a 1px rule, or transparent. Both move to surface-3 on hover.
- **Danger:** a danger wash with danger text and a 30% danger rule.

### Chips
- **Style:** 28px pill, surface-2 with a rule, muted text. The accent chip is a lime wash with lime text. The flame chip is a flame wash with flame text. Neither has a border.

### Cards / Containers
- **Corner Style:** 16px.
- **Background:** the surface tone on the ground, with a 1px rule. The raised variant uses the lit rule plus the ambient shadow.
- **Internal Padding:** 1rem.
- **Ruled section:** where a box would be too heavy, a section gets a 1px lit rule above it and 1rem of top padding instead.

### Inputs / Fields
- **Style:** 48px tall, surface-2 fill, 1px rule, 12px corners.
- **Focus:** the border turns to lime text and the fill lifts to the surface tone. The global focus ring is a 2px lime-text outline at a 2px offset.
- **Error:** a danger border and a danger message below.

### Navigation
- **Tab bar (mobile):** the ground at 86% with an 18px backdrop blur, on a 1px top rule. There are five slots. The centre slot is a raised 56px lime circle for Log.
- **Sidebar (lg):** 248px wide. Its Log is a full-width primary pill with the lime drop.
- **Segmented control:** a pill track (surface-2, 4px inset). The selected option becomes a surface pill with the ambient shadow.

### The Week Board (signature)
Seven columns of date boxes, one row per habit, inside a card. Today's column has a lime wash, lime text and a 1.5px lime ring. On Sundays the weekday letter is in lime text. Future boxes are faded and disabled. A done day gets a marker X in the habit's marker colour, and the date fades to 35% under it. A part-done day gets a single slash. A slip on a habit being quit gets a flame ring. Every box has an aria-label that names the state in words.

### The Tear-off Block (signature)
Today as a torn calendar page. It has a lime header band with the uppercase weekday, a dashed perforation in lime ink at 45%, a 3.4rem condensed day number and the month in muted text. The corners are 14px, with the lit rule and the ambient shadow.

### Marker Marks and the Tick Box (signature)
MarkerX, MarkerSlash and MarkerRing draw their strokes in with `stroke-dashoffset`: 150ms per stroke, the second stroke 120ms later, at 94% opacity. With reduced motion they appear instantly. The TickBox is a 20px box with 5px corners, a surface-2 fill and a 1.5px lit-rule border. It is crossed off with MarkerX, so "done" looks the same everywhere.

### Sibling surfaces
`web/` (www) and `blog/` share the palette through their own `@theme` blocks: the near-black ground, surfaces, rules, ink, lime, lime ink, flame and Archivo. Where their radii differ from the app's (www card 14px, xl2 20px), they follow their own stylesheets.

## Do's and Don'ts

### Do:
- **Do** use lime for the primary action and for today, and only there.
- **Do** use flame for the chain count, streak risk and slips.
- **Do** mark a done day with a MarkerX in the habit's category marker, and keep the date visible underneath at 35%.
- **Do** set every date and count in condensed, tabular Archivo (`.num`).
- **Do** define every colour in both the dark and the light block, and use lime-text-day wherever lime would be text on the light theme.
- **Do** keep flat cards flat. Put the ambient shadow only on things that float.
- **Do** put every animation behind `prefers-reduced-motion`, and have the marker stroke appear instantly under it.

### Don't:
- **Don't** bring back the paper-and-calendar-red palette. The user rejected it.
- **Don't** use raw lime as text, a line or a thin stroke on the light theme.
- **Don't** invent a second "done" mark. The tick box and the board both use the marker X.
- **Don't** add a second accent colour. Lime acts, flame is the streak, and the marker set only colours habit marks.
- **Don't** use a grey lighter than dim for text.
