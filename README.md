# PaceStreak App

The product itself — the signed-in frontend of
[PaceStreak](https://www.pacestreak.com), a habit and streak tracker. **Live
at [`app.pacestreak.com`](https://app.pacestreak.com).**

A React 19 + Vite + TypeScript PWA covering the whole product: habits (check,
duration, count and quit) with their own streaks and a whole-life streak;
training logs (quick, set-level and live) with plans, race plans and blocks;
week-based streaks with freezes, repairs and pauses; progress, records, weigh-ins
and body trends; XP, badges and quests; social, groups and challenges;
notifications, weekly and monthly recaps, file import, calendar subscription,
export and admin. It works offline through an IndexedDB outbox, and installs
to the home screen.

Copyright (c) 2026 PaceStreak. Licensed under [AGPL-3.0](./LICENSE) — anyone
running a modified version of this over a network must offer its source to
their users.

## Where this sits

| Hostname | Repository | What it is |
| --- | --- | --- |
| `www.pacestreak.com` | [`web`](https://github.com/PaceStreak/web) | Marketing site. Public, no login, indexed. |
| `app.pacestreak.com` | **this repository** | The product. Requires an account. Not indexed. |
| `api.pacestreak.com` | [`api`](https://github.com/PaceStreak/api) | Backend. |
| `blog.pacestreak.com` | [`blog`](https://github.com/PaceStreak/blog) | Build log. |

The split is deliberate: the marketing site must stay fast, static and
cacheable, and must never grow an auth dependency. Everything stateful lives
here. See [ARCHITECTURE.md](./ARCHITECTURE.md) for why that boundary is worth
the extra hostname.

## Status

| | |
| --- | --- |
| Stack | React 19, React Router, TanStack Query, Tailwind v4, Vite, `idb`, Phosphor icons |
| Rendering | Static SPA shell (decided; see [ARCHITECTURE.md](./ARCHITECTURE.md)) |
| Hostname | `app.pacestreak.com`, attached as a Pages custom domain |
| Depends on | [`PaceStreak/api`](https://github.com/PaceStreak/api) at `api.pacestreak.com` |
| Hosting | Cloudflare Pages, Git-connected, like every other site here |
| Tests | ~120 Vitest tests, including the outbox and parking against a real IndexedDB; Playwright end-to-end tests against the real API in `e2e/` (see [e2e/README.md](./e2e/README.md)) |
| Bot check | Cloudflare Turnstile on sign-up, sign-in and recovery (the one CSP exception) |

## Constraints already settled

These are not suggestions. Each one is either load-bearing for another
repository or was learned by breaking something.

### DNS records come from deployments, never by hand

A proxied Cloudflare record with nothing behind it returns **`522`**, which is
strictly worse than the hostname not existing. `app.pacestreak.com` got its
record by attaching the custom domain to the Pages project; keep it that way
for any future host. Do not hand-write records in the DNS tab.

### The session cookie is shared with every other subdomain

The auth cookie is scoped `Domain=pacestreak.com` so that it reaches
`api.pacestreak.com`. That means this app, the marketing site, the blog and the
status page all sit inside one trust boundary.

- Nothing untrusted may ever be hosted under `pacestreak.com` — no
  user-generated subdomains, no third-party tooling on a vanity host.
- Use the `__Secure-` prefix, not `__Host-`. `__Host-` forbids a `Domain`
  attribute, which this setup requires.
- `SameSite=Lax` is sufficient. This app and the API are *same-site* (shared
  registrable domain) even though they are cross-origin. Reaching for
  `SameSite=None` would widen exposure for nothing.

### The CSP names the API, and Turnstile is the only exception

Every site in this organization ships `default-src 'self'`. `public/_headers`
allows `connect-src 'self' https://api.pacestreak.com`; if the API ever moves,
change that line in the same commit as `PUBLIC_API_BASE_URL`, or every request
fails silently with no error a user would report. The only third-party origin
is `challenges.cloudflare.com` for Turnstile, in `script-src`, `connect-src`
and `frame-src`. Do not widen it further.

### This app must not be indexed

It is behind a login; indexing it produces search results that lead to a login
wall. Ship `robots.txt` with `Disallow: /` *and* a `noindex` header — the
`robots.txt` prevents crawling, the header prevents indexing of URLs discovered
by other means. **Both are in place** (`public/robots.txt`, `X-Robots-Tag` in
`public/_headers`).

The marketing site is the opposite: it must be indexed, and its
`robots.txt` allows everything. Do not copy one repository's file into the
other.

### Ship a real 404 page

Cloudflare Pages answers unknown paths with `index.html` and a **200** unless
the build emits `404.html`. On the blog, before that page existed,
`/robots.txt` returned the site's HTML and Cloudflare appended it to its own
content-signals policy — crawlers were handed a robots.txt with a full HTML
document inside it. A single-page app makes this worse, not better, because
every path legitimately renders the shell. **Handled in `vite.config.ts`:**
`_redirects` falls back to the shell only for the prefixes in
`src/routes.json`, and `404.html` is emitted for everything else. A new
top-level route must be added to `routes.json`.

### Export is a product promise

The marketing site promises full export. It has UI in Settings → Data: JSON,
CSV and ICS export, JSON import, GPX/FIT/CSV import, and the calendar feed.

## Local development

```bash
npm ci
npm run dev      # http://localhost:5173, talks to the API on http://localhost:8000
npm test         # vitest
npx playwright test  # end-to-end, against a running API; see e2e/README.md
npm run build    # typecheck + production build into dist/
```

Start the API first (`make dev` in `PaceStreak/api`). "You're offline, or the
server can't be reached" almost always means the API isn't on :8000.

## Deploying

Push to `main`. The Cloudflare Pages project builds from this repository via
Cloudflare's GitHub integration — there is no deploy workflow and no API token
to manage. CI here exists to fail a pull request before it reaches `main`, not
to deploy.

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) — how the pieces fit and why
- [CONTRIBUTING.md](./CONTRIBUTING.md) — how to work on this
- [SECURITY.md](./SECURITY.md) — reporting a vulnerability
- [CHANGELOG.md](./CHANGELOG.md) — what changed
- [Infrastructure](https://github.com/PaceStreak/infra) — DNS, Cloudflare, runbooks
