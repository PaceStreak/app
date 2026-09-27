# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React + Vite + TypeScript, Tailwind CSS v4, installable PWA. Static SPA on
Cloudflare Pages (Git-connected); talks only to `api.pacestreak.com`
(FastAPI). CSP is `default-src 'self'` with no `unsafe-inline`: no inline
scripts/styles in markup, `assetsInlineLimit: 0`, and one deliberate
third-party exception for Cloudflare Turnstile (`challenges.cloudflare.com`,
2026-09-27) on the forms that could otherwise be used to spam email.

## Users

Anyone keeping something up weekly: training (mixed-discipline regulars,
set-level lifters, beginners), and habits beyond it: learning a skill,
health, calm, people, money, home, creative work, and habits being broken.
They log on a phone, morning and evening or just after a session, often
one-handed, frequently with bad or no signal.

## Product Purpose

Make consistency the number people chase. Log a session in ten seconds, keep
a week-based streak against a target the user sets, watch a year-long grid
fill. Success is still training in month six, not a perfect week one.

## Positioning

Streaks that respect rest: the unit is the kept week against the user's own
target, planned rest never breaks anything, freezes and a monthly repair
forgive bad weeks, and nothing (XP, badges, boards) ever rewards load,
volume, body weight or training every day.

## Operating Context

One-handed phone use in gyms, trailheads and changing rooms; offline-first
(local outbox, sync on reconnect); quick one-tap log for any discipline,
optional depth (sets/reps/RPE, distance, pace). Social layer: follows with
approval, feed of system events, kudos, plain-text comments, groups with
coach consent, attendance-based challenges, opt-in leaderboards.

## Capabilities and Constraints

- Web never gains auth; this app is `noindex`, own `robots.txt`.
- Weights stored in kg, distances in m; units convert only at display.
- Under 13: no account. Under 16: private-only, no social/boards.
- No pricing claims anywhere. No third-party services or scripts, except
  Cloudflare Turnstile guarding signup/login/password/recovery forms.
- Body metrics are private and never competitive.
- Habits are never shown to anyone else: no feed, profile, group or board.

## Brand Commitments

Name PaceStreak. Palette (restored 2026-09-27 at the user's request): near-
black ground, lime `#d3ff3e` as the single action colour, flame `#ff6b35` for
the streak and risk, a daylight theme. Structure from the calendar redesign
stays: the week board, the marker X as the one mark for done, the tear-off
date, the lime bolt logo, self-hosted Archivo. Voice: plain, direct, dry, honest about limits,
never guilt-tripping ("skip it if you're hurt").

## Evidence on Hand

No users, testimonials, or metrics exist yet. Do not fabricate any.

## Product Principles

1. The fastest log wins; detail is always optional.
2. Rest is training; the product must never punish it.
3. Reward showing up, never magnitude.
4. Your data is yours: full export, private by default.
5. Works in a basement with no signal.

## Accessibility & Inclusion

WCAG AA contrast measured on actual surfaces; 320–1920px; visible focus;
skip link; everything animated behind `prefers-reduced-motion`; state never
conveyed by colour alone.
