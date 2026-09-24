# Surface: app home (Today) and the log flow

Scope: `src/routes/Today.tsx`, the shared shell, the Log sheet. Mode: Operate.
Audience: every PaceStreak user, on a phone, mid/after training, often offline.
Job: know the one thing that matters right now and act on it in one tap; log in ten seconds.

## Direction contract

THESIS: Home is a coach, not a dashboard — a short, ranked stack of cards that each say one true thing about right now and carry the action that answers it. Refuses the category default of a tile grid of equal stats and rings.

OWN-WORLD: web/'s near-black (#0a0a0b / #141417 surfaces, #26262c lines), lime #d3ff3e as the single action colour, flame #ff6b35 reserved for streak and risk, ink #f4f4f5 / muted #a1a1aa. Matte cards, 1px lines, soft offset shadow only on the raised card, tabular numerals for every number, authored line icons (1.75 stroke). Light theme for daylight: warm off-white ground, same accents deepened for contrast.

STORY: The user opens the app, reads the top card ("1 more session keeps week 7"), taps its action, logs in two taps, and sees the card resolve with a flame tick and XP — then closes the app.

FIRST VIEWPORT: 44px status strip (flame + streak weeks · level chip · week 2/4 day-dots). Below, the lead coach card at ~40% of viewport height: large one-line headline, one sentence of why, one primary lime action and one quiet secondary. Two smaller cards beneath. Floating lime Log button bottom-right above a five-item tab bar (Today, Progress, Log, Social, You), Log centred and raised.

FORM: Coach Cards, position 6 on re-roll-2 ordered list; seed key 16adcafe (reroll 2).
Signature interaction: completing a card's action resolves it in place (content blurs out, a flame tick draws, the next card slides up) — interruptible CSS transitions, ≤300ms, reduced-motion falls back to opacity.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
