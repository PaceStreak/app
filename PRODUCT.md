# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React + Vite + TypeScript, Tailwind CSS v4, installable PWA. Static SPA on
Cloudflare Pages (Git-connected); talks only to `api.pacestreak.com`
(FastAPI). CSP is `default-src 'self'` with no `unsafe-inline`: no inline
scripts/styles in markup, no third-party origins, `assetsInlineLimit: 0`.

## Users

Everyone who trains repeatedly: mixed-discipline regulars (lift, run, ride,
climb in one week), dedicated lifters who want set-level logging, and
beginners trying to make exercise stick at all. They log on a phone, usually
mid-session or just after, often tired, frequently with bad or no signal.

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
- No pricing claims anywhere. No third-party services or scripts.
- Body metrics are private and never competitive.

## Brand Commitments

Name PaceStreak. Existing marketing site at www.pacestreak.com: near-black
surfaces, lime accent `#d3ff3e`, flame `#ff6b35`, system font stack, the
five-level activity grid. Voice: plain, direct, dry, honest about limits,
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
