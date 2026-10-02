# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- React to a post with one of five preset reactions.
- Quiet days for reminders; the backup email can be weekly.
- Plans have a whole-plan calendar: every week and day at once, coloured
  by how each session went.
- Select several sessions to tag, set the gym or delete together, with Undo;
  Undo after editing a session.
- Fixed: a session saved while another was uploading waited up to 90
  seconds for the next periodic sync.
- Pick which weekdays a habit is for; pause or resume a single habit.
- End-to-end tests (Playwright) against the real stack, in CI.
- Fixed: the first visit reloaded the page when the service worker took
  over, wiping a half-typed sign-in. The 90-minute chip read "1.5.5 h".
  Logging offline before the library had ever loaded showed no activities.
- Import from Strong, Hevy and FitNotes, with a unit choice for Strong.
- Plan filters (strength, endurance, no equipment, fits my gym).
- Unsent changes are parked on sign-out, not deleted.
- Plate calculator "Load the bar" mode: pick the bar (presets, the gym's
  bar or any custom weight, remembered per exercise), tap plates for one side,
  read the total, and "Use" fills the next unfinished set.
- Sign-up and the updated-terms dialog name the health information a person
  consents to storing (weight, food, mood, habits).
- `AGENTS.md` with this repository's commands and rules for coding agents; the
  README and architecture notes now describe the live deployment, not a plan.
- Terms gate, /recover, email change in Security, crash reporting with a
  proper error screen, an admin Ops tab, and a getting-started checklist.
- Smart reminders, a monthly goal, rest days on the grid, comeback and
  deload suggestions, a spare-freeze note on the at-risk card.
- Supersets, warm-up ramps, kilometre splits, plan sharing.
- Plan challenges, coach plan suggestions, group announcements.

- Passkeys: sign in from a button or the email field's autofill; add,
  rename and remove them in Settings → Security. New 2FA recovery codes
  from Settings, with a low-count warning.
- Training plans (`/plans`) with templates, a week editor and a Today card;
  an interval timer (intervals, EMOM, Tabata); private tags and offline
  search in History; gear with mileage (Settings → Gear); progression hints
  for bodyweight reps and holds.
- Balanced-week requirements in the streak editor; consistency over 4, 12
  and 52 weeks; a year in review (`/review`); a timeline per record.
- A travel card when the phone changes timezone; `travel` pauses; an icon
  badge that can show the days still to go.
- Buddies (`/buddies`), a group streak card with a threshold setting, and
  preset encouragement from profiles and buddy cards.
- The admin Metrics tab shows the scheduler's health per job; the monthly
  backup reminder opens a one-tap download.
- Every signed-out screen and API error goes through the i18n catalog, with
  a guard test; `rich()` for sentences with links.

### Fixed

- A false "Travelling?" card for legacy timezone aliases (Asia/Calcutta).
- "just now ago", "1 members", "1 days" and similar wording.
- Week strips that were one stretched box for new streaks, pairs and groups.
- A sync test that raced the background push.

- A comment author's avatar link had no accessible name.
- Light-theme flame, danger and info text measured under 4.5:1 on the
  darkest surface.
- Paused weeks looked identical to missed ones in week strips.

- Mute a group; Chart/Table toggles on every chart and the grid; i18n
  groundwork (`src/lib/i18n.ts`); distinct shortcut icons; an "Easing back
  in?" suggestion after a long pause; an admin sheet for official status.
- Outbox tests against a real IndexedDB, i18n tests, and CI.

- Streak pause: declare and end injury/illness/life pauses in Settings →
  Training; a "Streak paused" card on Today replaces streak-risk nudges;
  "Paused" weeks in History.
- The grid marks planned rest days and paused days, with legend entries and
  text titles.
- `/recap`: the weekly recap, linked from Progress, the Monday digest and a
  home-screen shortcut.
- Settings → Data: GPX/FIT/CSV import with a per-file report, and a private
  calendar subscription (create, rotate, revoke; URL shown once).
- A verified mark for official accounts, and an admin control to grant it.
- Home-screen shortcuts for a live workout and the recap.
- The product frontend: a React 19 + Vite PWA with offline logging and sync,
  streaks, progress, records, XP and achievements, social, groups,
  challenges, leaderboards, notifications, settings, data export/import and
  admin.

- Repository created to hold the signed-in product frontend for
  `app.pacestreak.com`, split from the marketing site at `www`.
- Documentation of the constraints that already bind this code before any of it
  exists: the shared-domain session cookie, the `default-src 'self'` CSP that
  will block the first API call, the `noindex` requirement, and the reason the
  DNS record must not be created ahead of a deployment.
- `ARCHITECTURE.md`, recording the rendering-strategy decision (since made:
  a static SPA shell) with its trade-off table.
