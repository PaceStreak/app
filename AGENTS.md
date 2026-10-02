# AGENTS.md — app

The PaceStreak product: a React 19 + Vite + TypeScript PWA, live at
`app.pacestreak.com`.

Workspace-wide rules (CSP, cookies, privacy, commit conventions, what is
already decided) live in the root
[`AGENTS.md`](https://github.com/PaceStreak/pacestreak/blob/main/AGENTS.md).
Read it first; this file only adds what is specific to this repository.

## Commands

```bash
npm ci
npm run dev       # :5173, talks to the API on :8000 (start api first: make dev)
npm test          # vitest
npm run build     # tsc -b + vite build; CI also checks dist for 404, noindex
                  # and inline scripts
```

## Rules for this repo

- There is **no Prettier config**; don't run a formatter over whole files.
  Match the surrounding style by hand.
- `public/_headers` CSP: `connect-src` names `https://api.pacestreak.com`.
  Change it in the same commit as `PUBLIC_API_BASE_URL` if the API moves.
  Turnstile (`challenges.cloudflare.com`) is the only third-party origin;
  never add another.
- The app must stay `noindex` with `robots.txt` `Disallow: /`. Never copy
  `web`'s `robots.txt` here.
- A new top-level route must be added to `src/routes.json`, or it 404s.
- Every read of a new stats field needs a fallback (`?? []`): the PWA caches
  old API payloads offline.
- Habits, food, body and journal data never appear on a social surface.
- Palette is near-black with lime `#d3ff3e` and flame `#ff6b35`; see
  `DESIGN.md`. Paint activity-grid cells only via the level class.
- Measure contrast against the real background (WCAG AA).

## Deploying

Push to `main`; Cloudflare Pages builds it. There is no deploy workflow.

## Commits

Conventional commits, subject says what, body says why. Commit as
`AlzyWelzy <welzyalzy@gmail.com>`. **Never credit an AI tool**: no
`Co-Authored-By` trailer and no "Generated with" line, in commits or PRs.
This repository is public, so never commit a secret.
