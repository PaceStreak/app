# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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
